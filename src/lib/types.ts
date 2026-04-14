export type Direction = "incoming" | "outgoing";
export type Urgency = "most_urgent" | null;

export interface PurchaseOrder {
  id: string;
  direction: Direction;
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
  urgency: Urgency;
  owner: string;
  paymentTerms: string;
}

export interface POWithComputed extends PurchaseOrder {
  ageDays: number;
  overdueDays: number;
  ageBucket: AgeBucket;
  overdueBucket: OverdueBucket;
}

export type AgeBucket =
  | "0-30d"
  | "31-60d"
  | "61-90d"
  | "91-180d"
  | "180d+";

export type OverdueBucket =
  | "not_due"
  | "no_date"
  | "1-7d"
  | "8-21d"
  | "22-30d"
  | "30d+";

export interface CompanySummary {
  name: string;
  poCount: number;
  totalValue: number;
  avgAgeDays: number;
  overdueCount: number;
  urgentCount: number;
}

export interface DashboardKPIs {
  totalPendingValue: number;
  totalPOCount: number;
  overdueCount: number;
  urgentCount: number;
  avgAgeDays: number;
  incomingValue: number;
  outgoingValue: number;
}
