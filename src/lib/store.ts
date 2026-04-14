"use client";

import { createContext, useContext } from "react";
import type { POWithComputed, Direction } from "./types";

export interface DashboardFilters {
  direction: Direction | "all";
  suppliers: string[];
  customers: string[];
  urgencyOnly: boolean;
  overdueOnly: boolean;
  search: string;
  companyView: "supplier" | "customer";
}

export const defaultFilters: DashboardFilters = {
  direction: "all",
  suppliers: [],
  customers: [],
  urgencyOnly: false,
  overdueOnly: false,
  search: "",
  companyView: "supplier",
};

export interface DashboardContextValue {
  allPOs: POWithComputed[];
  filteredPOs: POWithComputed[];
  filters: DashboardFilters;
  setFilters: (f: DashboardFilters) => void;
  updateFilter: <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K]
  ) => void;
  uniqueSuppliers: string[];
  uniqueCustomers: string[];
  drilldownCompany: string | null;
  setDrilldownCompany: (c: string | null) => void;
}

export const DashboardContext = createContext<DashboardContextValue | null>(
  null
);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
