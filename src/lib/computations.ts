import type {
  PurchaseOrder,
  POWithComputed,
  AgeBucket,
  OverdueBucket,
  CompanySummary,
  DashboardKPIs,
  Direction,
} from "./types";

const TODAY = new Date();
const TODAY_MS = TODAY.getTime();

function daysBetween(from: string | null, to: Date = TODAY): number {
  if (!from) return 0;
  const d = new Date(from);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((to.getTime() - d.getTime()) / 86_400_000);
}

function getAgeBucket(days: number): AgeBucket {
  if (days <= 30) return "0-30d";
  if (days <= 60) return "31-60d";
  if (days <= 90) return "61-90d";
  if (days <= 180) return "91-180d";
  return "180d+";
}

function getOverdueBucket(po: PurchaseOrder): OverdueBucket {
  if (!po.dueDate) return "no_date";
  const dueMs = new Date(po.dueDate).getTime();
  if (isNaN(dueMs)) return "no_date";
  const overdueDays = Math.floor((TODAY_MS - dueMs) / 86_400_000);
  if (overdueDays <= 0) return "not_due";
  if (overdueDays <= 7) return "1-7d";
  if (overdueDays <= 21) return "8-21d";
  if (overdueDays <= 30) return "22-30d";
  return "30d+";
}

export function computeAging(po: PurchaseOrder): POWithComputed {
  const ageDays = Math.max(0, daysBetween(po.poDate));
  const rawOverdue = po.dueDate ? daysBetween(po.dueDate) : 0;
  const overdueDays = Math.max(0, rawOverdue);

  return {
    ...po,
    ageDays,
    overdueDays,
    ageBucket: po.poDate ? getAgeBucket(ageDays) : "0-30d",
    overdueBucket: getOverdueBucket(po),
  };
}

export function computeKPIs(pos: POWithComputed[]): DashboardKPIs {
  const totalPendingValue = pos.reduce((s, p) => s + p.total, 0);
  const overdueCount = pos.filter((p) => p.overdueDays > 0).length;
  const urgentCount = pos.filter((p) => p.urgency === "most_urgent").length;
  const withAge = pos.filter((p) => p.poDate);
  const avgAgeDays =
    withAge.length > 0
      ? Math.round(withAge.reduce((s, p) => s + p.ageDays, 0) / withAge.length)
      : 0;

  return {
    totalPendingValue,
    totalPOCount: pos.length,
    overdueCount,
    urgentCount,
    avgAgeDays,
    incomingValue: pos
      .filter((p) => p.direction === "incoming")
      .reduce((s, p) => s + p.total, 0),
    outgoingValue: pos
      .filter((p) => p.direction === "outgoing")
      .reduce((s, p) => s + p.total, 0),
  };
}

export function computeCompanySummaries(
  pos: POWithComputed[],
  groupBy: "supplier" | "customer"
): CompanySummary[] {
  const groups = new Map<string, POWithComputed[]>();

  for (const po of pos) {
    const key = po[groupBy];
    if (!key) continue;
    const arr = groups.get(key) || [];
    arr.push(po);
    groups.set(key, arr);
  }

  return Array.from(groups.entries())
    .map(([name, items]) => {
      const withAge = items.filter((p) => p.poDate);
      return {
        name,
        poCount: items.length,
        totalValue: items.reduce((s, p) => s + p.total, 0),
        avgAgeDays:
          withAge.length > 0
            ? Math.round(
                withAge.reduce((s, p) => s + p.ageDays, 0) / withAge.length
              )
            : 0,
        overdueCount: items.filter((p) => p.overdueDays > 0).length,
        urgentCount: items.filter((p) => p.urgency === "most_urgent").length,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);
}

export interface AgingBucketData {
  bucket: string;
  count: number;
  value: number;
}

export function computeAgingBuckets(pos: POWithComputed[]): AgingBucketData[] {
  const bucketOrder: AgeBucket[] = [
    "0-30d",
    "31-60d",
    "61-90d",
    "91-180d",
    "180d+",
  ];
  const map = new Map<AgeBucket, { count: number; value: number }>();
  for (const b of bucketOrder) map.set(b, { count: 0, value: 0 });

  for (const po of pos) {
    if (!po.poDate) continue;
    const entry = map.get(po.ageBucket)!;
    entry.count++;
    entry.value += po.total;
  }

  return bucketOrder.map((bucket) => ({
    bucket,
    ...map.get(bucket)!,
  }));
}

export function computeOverdueBuckets(
  pos: POWithComputed[]
): AgingBucketData[] {
  const bucketOrder: OverdueBucket[] = [
    "not_due",
    "1-7d",
    "8-21d",
    "22-30d",
    "30d+",
  ];
  const map = new Map<OverdueBucket, { count: number; value: number }>();
  for (const b of bucketOrder) map.set(b, { count: 0, value: 0 });

  for (const po of pos) {
    if (po.overdueBucket === "no_date") continue;
    const entry = map.get(po.overdueBucket)!;
    entry.count++;
    entry.value += po.total;
  }

  return bucketOrder.map((bucket) => ({
    bucket: bucket === "not_due" ? "Not Yet Due" : bucket + " overdue",
    ...map.get(bucket)!,
  }));
}

export function filterPOs(
  pos: POWithComputed[],
  filters: {
    direction?: Direction | "all";
    suppliers?: string[];
    customers?: string[];
    urgencyOnly?: boolean;
    overdueOnly?: boolean;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): POWithComputed[] {
  let result = pos;

  if (filters.direction && filters.direction !== "all") {
    result = result.filter((p) => p.direction === filters.direction);
  }

  if (filters.suppliers && filters.suppliers.length > 0) {
    const set = new Set(filters.suppliers);
    result = result.filter((p) => set.has(p.supplier));
  }

  if (filters.customers && filters.customers.length > 0) {
    const set = new Set(filters.customers);
    result = result.filter((p) => set.has(p.customer));
  }

  if (filters.urgencyOnly) {
    result = result.filter((p) => p.urgency === "most_urgent");
  }

  if (filters.overdueOnly) {
    result = result.filter((p) => p.overdueDays > 0);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.description.toLowerCase().includes(q) ||
        p.poNumber.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q)
    );
  }

  if (filters.dateFrom) {
    result = result.filter((p) => p.poDate && p.poDate >= filters.dateFrom!);
  }

  if (filters.dateTo) {
    result = result.filter((p) => p.poDate && p.poDate <= filters.dateTo!);
  }

  return result;
}

export function formatINR(value: number): string {
  if (value === 0) return "₹0";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  }

  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatINRFull(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
