"use client";

import { useDashboard } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, AlertTriangle, Clock, RotateCcw } from "lucide-react";
import type { Direction } from "@/lib/types";
import { defaultFilters } from "@/lib/store";

export function FilterBar() {
  const {
    filters,
    updateFilter,
    setFilters,
    uniqueSuppliers,
    uniqueCustomers,
  } = useDashboard();

  const hasActiveFilters =
    filters.direction !== "all" ||
    filters.suppliers.length > 0 ||
    filters.customers.length > 0 ||
    filters.urgencyOnly ||
    filters.overdueOnly ||
    filters.search !== "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search PO, description, company..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter("search", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Direction */}
        <Select
          value={filters.direction}
          onValueChange={(v) => updateFilter("direction", v as Direction | "all")}
        >
          <SelectTrigger className="w-[130px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All POs</SelectItem>
            <SelectItem value="incoming">Incoming</SelectItem>
            <SelectItem value="outgoing">Outgoing</SelectItem>
          </SelectContent>
        </Select>

        {/* Supplier */}
        <Select
          value={filters.suppliers.length === 1 ? filters.suppliers[0] : "all"}
          onValueChange={(v) =>
            updateFilter("suppliers", !v || v === "all" ? [] : [v])
          }
        >
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {uniqueSuppliers.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Customer */}
        <Select
          value={filters.customers.length === 1 ? filters.customers[0] : "all"}
          onValueChange={(v) =>
            updateFilter("customers", !v || v === "all" ? [] : [v])
          }
        >
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {uniqueCustomers.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle buttons */}
        <Button
          variant={filters.overdueOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => updateFilter("overdueOnly", !filters.overdueOnly)}
        >
          <Clock className="h-3 w-3" />
          Overdue
        </Button>

        <Button
          variant={filters.urgencyOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => updateFilter("urgencyOnly", !filters.urgencyOnly)}
        >
          <AlertTriangle className="h-3 w-3" />
          Urgent
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-muted-foreground"
            onClick={() => setFilters(defaultFilters)}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {filters.direction !== "all" && (
            <Badge variant="secondary" className="text-xs gap-1">
              {filters.direction}
              <button onClick={() => updateFilter("direction", "all")}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
          {filters.suppliers.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs gap-1">
              {s}
              <button onClick={() => updateFilter("suppliers", [])}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          {filters.customers.map((c) => (
            <Badge key={c} variant="secondary" className="text-xs gap-1">
              {c}
              <button onClick={() => updateFilter("customers", [])}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
