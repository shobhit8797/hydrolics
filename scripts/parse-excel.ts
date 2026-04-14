import * as XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface RawPO {
  id: string;
  direction: "incoming" | "outgoing";
  sourceSheet: string;
  slNo: string;
  poNumber: string;
  poDate: string | null;
  dueDate: string | null;
  description: string;
  qty: number;
  rateEach: number;
  total: number;
  supplier: string;
  customer: string;
  deliveryText: string;
  committedDelivery: string;
  remark: string;
  urgency: "most_urgent" | null;
  owner: string;
  paymentTerms: string;
}

// --- Date parsing ---

function parseExcelDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;

  const s = String(raw).trim();

  if (s === "0" || s === "1900-01-01 00:00:00" || s.startsWith("1900-01-01"))
    return null;

  // Already an ISO datetime from openpyxl/xlsx — e.g., "2025-09-30 00:00:00" or "2025-09-30T00:00:00"
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (Number(y) < 1950 || Number(y) > 2099) return null;
    return `${y}-${m}-${d}`;
  }

  // DD.MM.YYYY — e.g., "28.11.2025"
  const dotFull = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotFull) {
    const [, d, m, y] = dotFull;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD:MM:YY — Excel misread as time, e.g., "19:11:25" means 19-Nov-2025
  const colonYY = s.match(/^(\d{1,2}):(\d{1,2}):(\d{2})$/);
  if (colonYY) {
    const [, d, m, yy] = colonYY;
    const dd = Number(d),
      mm = Number(m),
      yyN = Number(yy);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const year = yyN < 50 ? 2000 + yyN : 1900 + yyN;
      return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  // DD.MM-YY — e.g., "31.05-25"
  const dotDash = s.match(/^(\d{1,2})\.(\d{1,2})-(\d{2})$/);
  if (dotDash) {
    const [, d, m, yy] = dotDash;
    const year = Number(yy) < 50 ? 2000 + Number(yy) : 1900 + Number(yy);
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD.MM.YY — e.g., "12.03.25"
  const dotShort = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (dotShort) {
    const [, d, m, yy] = dotShort;
    const year = Number(yy) < 50 ? 2000 + Number(yy) : 1900 + Number(yy);
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // M/D/YY or MM/DD/YY (US-style from SheetJS formatting) — e.g., "9/30/25", "1/29/26"
  const slashShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShort) {
    const [, m, d, yy] = slashShort;
    const year = Number(yy) < 50 ? 2000 + Number(yy) : 1900 + Number(yy);
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // M/D/YYYY — e.g., "9/30/2025"
  const slashFull = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashFull) {
    const [, m, d, y] = slashFull;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // "1 day, 0:06:25" type artifact — skip
  if (s.includes("day,")) return null;

  // Numeric Excel serial date
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + serial * 86400000);
    if (d.getFullYear() < 1950) return null;
    return d.toISOString().slice(0, 10);
  }

  // If it's a JS Date from xlsx
  if (raw instanceof Date) {
    if (raw.getFullYear() < 1950) return null;
    return raw.toISOString().slice(0, 10);
  }

  return null;
}

function isTextualDelivery(s: string): boolean {
  const upper = s.toUpperCase();
  return (
    /WEEK/i.test(upper) ||
    /MONTH/i.test(upper) ||
    /IMMEDIATE/i.test(upper) ||
    /END OF/i.test(upper) ||
    /DISPATCH/i.test(upper) ||
    /CANCEL/i.test(upper) ||
    /PENDING/i.test(upper) ||
    /STOCK/i.test(upper) ||
    /URGENT/i.test(upper)
  );
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function num(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function detectUrgency(remark: string): "most_urgent" | null {
  return /MOST\s*URGENT/i.test(remark) || /URGENT\s*REQUIRED/i.test(remark)
    ? "most_urgent"
    : null;
}

let idCounter = 0;
function nextId(sheet: string): string {
  return `${sheet.replace(/\s+/g, "_")}_${++idCounter}`;
}

// --- Sheet parsers ---

function sheetRows(wb: XLSX.WorkBook, name: string): string[][] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as string[][];
}

function parseIncomingPO(wb: XLSX.WorkBook): RawPO[] {
  const rows = sheetRows(wb, "INCOMING PO");
  const results: RawPO[] = [];
  let currentCustomer = "";
  let parentPO: Partial<RawPO> = {};

  const maxRow = Math.min(rows.length, 500);
  for (let i = 2; i < maxRow; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const colA = str(row[0]);
    const colB = str(row[1]);

    // Section header detection: col A has text, col B empty, not a number
    if (colA && !colB && isNaN(Number(colA))) {
      currentCustomer = colA;
      continue;
    }

    const desc = str(row[4]);
    if (!desc) continue;

    const hasSlNo = colA && !isNaN(Number(colA));
    const poNum = str(row[1]);

    if (hasSlNo && poNum) {
      parentPO = {
        slNo: colA,
        poNumber: poNum,
        poDate: parseExcelDate(row[2]),
        dueDate: parseExcelDate(row[3]),
        customer: currentCustomer,
        paymentTerms: str(row[10]),
      };
    }

    const rawDelivery = str(row[3]);
    const supplier = str(row[9]);

    results.push({
      id: nextId("INCOMING_PO"),
      direction: "incoming",
      sourceSheet: "INCOMING PO",
      slNo: parentPO.slNo || "",
      poNumber: parentPO.poNumber || poNum,
      poDate: parentPO.poDate || null,
      dueDate: isTextualDelivery(rawDelivery)
        ? null
        : parseExcelDate(row[3]) || parentPO.dueDate || null,
      description: desc,
      qty: num(row[5]),
      rateEach: num(row[6]),
      total: num(row[7]),
      supplier:
        supplier && supplier !== "STOCK" && supplier !== "PENDING"
          ? supplier
          : parentPO.supplier || supplier,
      customer: currentCustomer || parentPO.customer || "",
      deliveryText: "",
      committedDelivery: "",
      remark: "",
      urgency: null,
      owner: "",
      paymentTerms: parentPO.paymentTerms || str(row[10]),
    });
  }

  return results;
}

function parseOutgoingPO(wb: XLSX.WorkBook): RawPO[] {
  const rows = sheetRows(wb, "OUTGOING PO");
  const results: RawPO[] = [];
  let parentPO: Partial<RawPO> = {};

  // Row 0 = "OUTGOING P.O. DETAIL", Row 1 = header, data starts row 2
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const principal = str(row[1]);
    const product = str(row[2]);
    const rateCol = str(row[6]);

    // Skip TOTAL summary rows
    if (rateCol.toUpperCase().includes("TOTAL")) continue;

    if (!product && !principal) continue;

    const hasNewPO = principal !== "";

    if (hasNewPO) {
      const rawDeliveryDate = str(row[9]);
      const rawCommitted = str(row[10]);

      parentPO = {
        slNo: str(row[0]),
        supplier: principal,
        poNumber: str(row[3]),
        poDate: parseExcelDate(row[4]),
        customer: str(row[8]),
        deliveryText: isTextualDelivery(rawDeliveryDate)
          ? rawDeliveryDate
          : "",
        dueDate: isTextualDelivery(rawDeliveryDate)
          ? null
          : parseExcelDate(row[9]),
        committedDelivery: isTextualDelivery(rawCommitted)
          ? rawCommitted
          : str(row[10]),
      };
    }

    if (!product) continue;

    results.push({
      id: nextId("OUTGOING_PO"),
      direction: "outgoing",
      sourceSheet: "OUTGOING PO",
      slNo: parentPO.slNo || "",
      poNumber: parentPO.poNumber || "",
      poDate: parentPO.poDate || null,
      dueDate: parentPO.dueDate || null,
      description: product,
      qty: num(row[5]),
      rateEach: num(row[6]),
      total: num(row[7]),
      supplier: parentPO.supplier || "",
      customer: parentPO.customer || "",
      deliveryText: parentPO.deliveryText || "",
      committedDelivery: parentPO.committedDelivery || "",
      remark: "",
      urgency: null,
      owner: "",
      paymentTerms: "",
    });
  }

  return results;
}

function parseSankalp(wb: XLSX.WorkBook): RawPO[] {
  const rows = sheetRows(wb, "SANKALP");
  const results: RawPO[] = [];

  // Header at row 1 (index 0), data starts row 2 (index 1)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const desc = str(row[3]);
    if (!desc) continue;

    const rawDelivery = str(row[8]);
    const rawDeliveryDate = str(row[9]);
    const remark = str(row[10]);

    results.push({
      id: nextId("SANKALP"),
      direction: "outgoing",
      sourceSheet: "SANKALP",
      slNo: str(row[0]),
      poNumber: str(row[1]),
      poDate: parseExcelDate(row[2]),
      dueDate: isTextualDelivery(rawDeliveryDate)
        ? null
        : parseExcelDate(row[9]),
      description: desc,
      qty: num(row[4]),
      rateEach: num(row[5]),
      total: num(row[6]),
      supplier: "SANKALP",
      customer: str(row[7]),
      deliveryText: isTextualDelivery(rawDelivery) ? rawDelivery : "",
      committedDelivery: "",
      remark,
      urgency: detectUrgency(remark) || detectUrgency(rawDelivery),
      owner: "",
      paymentTerms: "",
    });
  }

  return results;
}

function parseTataSteel(wb: XLSX.WorkBook): RawPO[] {
  const rows = sheetRows(wb, "TATA STEEL");
  const results: RawPO[] = [];
  let parentPO: Partial<RawPO> = {};

  // Header at row 1 (index 0), data starts row 2 (index 1)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const desc = str(row[5]);
    if (!desc) continue;

    const slNo = str(row[0]);
    const poNum = str(row[1]);

    if (slNo && poNum) {
      const remarkText = str(row[10]);
      const urgencyCol = str(row[11]);

      parentPO = {
        slNo,
        poNumber: poNum,
        poDate: parseExcelDate(row[2]),
        dueDate: parseExcelDate(row[3]),
        owner: remarkText,
        remark: urgencyCol,
      };
    }

    const orderPlacedTo = str(row[9]);

    results.push({
      id: nextId("TATA_STEEL"),
      direction: "incoming",
      sourceSheet: "TATA STEEL",
      slNo: parentPO.slNo || "",
      poNumber: parentPO.poNumber || "",
      poDate: parentPO.poDate || null,
      dueDate: parentPO.dueDate || null,
      description: desc,
      qty: num(row[6]),
      rateEach: num(row[7]),
      total: num(row[8]),
      supplier: orderPlacedTo.replace(/,\s*(DISPATCH|PENDING).*$/i, "").trim(),
      customer: "TATA STEEL",
      deliveryText: "",
      committedDelivery: "",
      remark: parentPO.remark || "",
      urgency: detectUrgency(parentPO.remark || "") || detectUrgency(str(row[11])),
      owner: parentPO.owner || "",
      paymentTerms: "",
    });
  }

  return results;
}

function parseYuken(wb: XLSX.WorkBook): RawPO[] {
  const rows = sheetRows(wb, "Yuken");
  const results: RawPO[] = [];

  // With raw:false, SheetJS drops the empty leading col A.
  // Row 0 = header: [SL NO, SO NO, SO DATE, DESCRIPTION, QTY, REMARKS, ...]
  // Data starts at row 1 (index 1)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const slNo = str(row[0]);
    const soNo = str(row[1]);
    const desc = str(row[3]);
    if (!desc) continue;
    if (!slNo && !soNo) continue;

    const remarks = str(row[5]);

    results.push({
      id: nextId("YUKEN"),
      direction: "outgoing",
      sourceSheet: "Yuken",
      slNo,
      poNumber: soNo,
      poDate: parseExcelDate(row[2]),
      dueDate: null,
      description: desc,
      qty: num(row[4]),
      rateEach: 0,
      total: 0,
      supplier: "YUKEN INDIA",
      customer: "",
      deliveryText: "",
      committedDelivery: "",
      remark: remarks,
      urgency: detectUrgency(remarks),
      owner: "",
      paymentTerms: "",
    });
  }

  return results;
}

// --- Normalize supplier names ---
function normalizeSupplier(name: string): string {
  const upper = name.toUpperCase().trim();

  // Filter out non-supplier entries
  if (upper.startsWith("SO NO-") || upper === "DISPATCH" || upper === "STOCK" || upper === "PENDING")
    return "";

  const map: Record<string, string> = {
    SANKLAP: "SANKALP",
    SANKALP: "SANKALP",
    "SANKALP, 01 NO DISPATCH": "SANKALP",
    "SANKALP, DISPATCH": "SANKALP",
    "HENGST, PENDING": "HENGST",
    HENGST: "HENGST",
    "HENGST FILTRATION PRIVATE LTD": "HENGST",
    "A S BEARING": "A S BEARING",
    "A S BEARING COMPANY": "A S BEARING",
    "RAJDEEP IND.": "RAJDEEP IND",
    "RAJDEEP IND": "RAJDEEP IND",
    RAJDEEP: "RAJDEEP IND",
    ELECTRO: "ELECTRO HYD",
    "ELECTRO HYD": "ELECTRO HYD",
    "ELECTRO HYDRO": "ELECTRO HYD",
    "EXCELLENT HYD": "EXCELLENT HYD",
    EXCELLENT: "EXCELLENT HYD",
    REMSWEGS: "REMSWEGS",
    REMSWEGE: "REMSWEGS",
    "SANJAY HYD": "SANJAY HYD",
    YUKEN: "YUKEN INDIA",
    "YUKEN INDIA": "YUKEN INDIA",
    SPLEDENT: "SPLENDENT HYD",
    SPLENDENT: "SPLENDENT HYD",
    "SPLEDENT HYD": "SPLENDENT HYD",
    "SPLENDENT HYD": "SPLENDENT HYD",
    HYDTECH: "HYDTECH",
    "HYDTECH INNOVATIVS": "HYDTECH",
    "PROCESS ENGINEERS AND ASSOCIATES": "PROCESS ENGG",
    "PROCESS ENGG": "PROCESS ENGG",
  };
  return map[upper] || name.trim();
}

function normalizeCustomer(name: string): string {
  const upper = name.toUpperCase().trim();

  if (upper === "IMMEDIATE" || upper === "01 NO DISPTACH") return "";

  const map: Record<string, string> = {
    "JSPL-A": "JSPL ANGUL",
    "JSPL-ANGUL": "JSPL ANGUL",
    "JSPL- ANGUL": "JSPL ANGUL",
    "JSPL-A, 09 NOS DISPTACH": "JSPL ANGUL",
    "JSPL-R": "JSPL RAIGARH",
    "JSPL-RAIGARH": "JSPL RAIGARH",
    "JSOL- ANGUL": "JSOL ANGUL",
    JSOL: "JSOL ANGUL",
    JSL: "JINDAL STAINLESS",
    "JINDAL STAINLESS": "JINDAL STAINLESS",
    "TATA STEEL": "TATA STEEL",
    TATA: "TATA STEEL",
    "TATA STEEL- DHENKANAL": "TATA STEEL",
    "TATA- DHENKANAL": "TATA STEEL",
    "TATA- DHENAKANAL": "TATA STEEL",
    "TATA-DHENKANAL": "TATA STEEL",
    "TATA- BISTUPUR": "TATA STEEL",
    "TATA-BISTUPUR": "TATA STEEL",
    "TATA- TISCO": "TATA STEEL",
    "TATA-TISCO": "TATA STEEL",
    "TATA- JAJPUR": "TATA STEEL",
    "TATA- DUBARI": "TATA STEEL",
    "TATA- GAMARIA": "TATA STEEL",
    "TATA- KHOPOLI": "TATA STEEL",
    "TATA- STEEL- KHOPOLI": "TATA STEEL",
    "IMFA- INDIAN METAILS": "IMFA",
    IMFA: "IMFA",
    "MOGLIX (VEDANTA)  - JHARSUGUDA": "MOGLIX",
    "MOGLIX- VEDANTA": "MOGLIX",
    MOGLIX: "MOGLIX",
    "EMAMI PAPER MILLS": "EMAMI",
    EMAMI: "EMAMI",
    "SPINTECH TUBES PVT LTD": "SPINTECH",
    "BRAHMANI RIVER": "BRAHMANI RIVER",
    "JSW- BPSL": "JSW BPSL",
    "JSW- BSPL": "JSW BPSL",
    "BRPL- JAJPUR": "BRPL JAJPUR",
    "RSP SAIL": "RSP SAIL",
    "IFGL REF": "IFGL REFRACTORIES",
    "IFGL REFRACTORIES": "IFGL REFRACTORIES",
    "BAIN GLOBAL": "BAIN GLOBAL",
    "BAIN GLOBAL RESOURCES": "BAIN GLOBAL",
    "DALMIA BHARAT": "DALMIA BHARAT",
    "HINDALCO- LAPANGA": "HINDALCO",
    HINDALCO: "HINDALCO",
    "HINDALCO- FRP": "HINDALCO",
    "VISA STEEL": "VISA STEEL",
    "RUNGTA MINES": "RUNGTA MINES",
  };
  return map[upper] || name.trim();
}

// --- Main ---
function main() {
  const excelPath = join(__dirname, "..", "data", "PENDING ORDER-GH.xlsx");
  const outPath = join(__dirname, "..", "data", "po-data.json");

  console.log(`Reading ${excelPath}...`);
  const wb = XLSX.readFile(excelPath);

  const allPOs: RawPO[] = [
    ...parseIncomingPO(wb),
    ...parseOutgoingPO(wb),
    ...parseSankalp(wb),
    ...parseTataSteel(wb),
    ...parseYuken(wb),
  ];

  for (const po of allPOs) {
    po.supplier = normalizeSupplier(po.supplier);
    po.customer = normalizeCustomer(po.customer);
  }

  // Filter out rows with no meaningful data
  const filtered = allPOs.filter(
    (po) => po.description && (po.qty > 0 || po.total > 0 || po.poNumber)
  );

  mkdirSync(join(__dirname, "..", "data"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(filtered, null, 2));

  console.log(`Wrote ${filtered.length} POs to ${outPath}`);

  // Quick stats
  const incoming = filtered.filter((p) => p.direction === "incoming");
  const outgoing = filtered.filter((p) => p.direction === "outgoing");
  console.log(`  Incoming: ${incoming.length}, Outgoing: ${outgoing.length}`);

  const sheets = new Set(filtered.map((p) => p.sourceSheet));
  for (const sheet of sheets) {
    const count = filtered.filter((p) => p.sourceSheet === sheet).length;
    console.log(`  ${sheet}: ${count} records`);
  }
}

main();
