import rawData from "../../data/po-data.json";
import type { PurchaseOrder, POWithComputed } from "./types";
import { computeAging } from "./computations";

const poData: PurchaseOrder[] = rawData as PurchaseOrder[];

export function getAllPOs(): POWithComputed[] {
  return poData.map((po) => computeAging(po));
}

export function getUniqueSuppliers(): string[] {
  const set = new Set(poData.map((p) => p.supplier).filter(Boolean));
  return Array.from(set).sort();
}

export function getUniqueCustomers(): string[] {
  const set = new Set(poData.map((p) => p.customer).filter(Boolean));
  return Array.from(set).sort();
}
