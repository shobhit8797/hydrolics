"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import { DashboardContext, defaultFilters, type DashboardFilters } from "@/lib/store";
import type { POWithComputed } from "@/lib/types";
import { filterPOs } from "@/lib/computations";

interface Props {
  allPOs: POWithComputed[];
  uniqueSuppliers: string[];
  uniqueCustomers: string[];
  children: ReactNode;
}

export function DashboardProvider({
  allPOs,
  uniqueSuppliers,
  uniqueCustomers,
  children,
}: Props) {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [drilldownCompany, setDrilldownCompany] = useState<string | null>(null);

  const updateFilter = useCallback(
    <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const filteredPOs = useMemo(
    () =>
      filterPOs(allPOs, {
        direction: filters.direction,
        suppliers: filters.suppliers,
        customers: filters.customers,
        urgencyOnly: filters.urgencyOnly,
        overdueOnly: filters.overdueOnly,
        search: filters.search,
      }),
    [allPOs, filters]
  );

  const value = useMemo(
    () => ({
      allPOs,
      filteredPOs,
      filters,
      setFilters,
      updateFilter,
      uniqueSuppliers,
      uniqueCustomers,
      drilldownCompany,
      setDrilldownCompany,
    }),
    [
      allPOs,
      filteredPOs,
      filters,
      updateFilter,
      uniqueSuppliers,
      uniqueCustomers,
      drilldownCompany,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
