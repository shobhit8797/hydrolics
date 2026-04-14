"use client";

import { useState, useMemo } from "react";
import { useDashboard } from "@/lib/store";
import { formatINRFull } from "@/lib/computations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { POWithComputed } from "@/lib/types";

type SortKey =
  | "poDate"
  | "dueDate"
  | "total"
  | "qty"
  | "ageDays"
  | "overdueDays"
  | "supplier"
  | "customer";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active)
    return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return dir === "asc" ? (
    <ChevronUp className="h-3 w-3" />
  ) : (
    <ChevronDown className="h-3 w-3" />
  );
}

function StatusBadge({ po }: { po: POWithComputed }) {
  if (po.urgency === "most_urgent") {
    return (
      <Badge
        variant="secondary"
        className="bg-warning/10 text-warning text-[10px]"
      >
        URGENT
      </Badge>
    );
  }
  if (po.overdueDays > 0) {
    return (
      <Badge
        variant="secondary"
        className="bg-overdue/10 text-overdue text-[10px]"
      >
        {po.overdueDays}d overdue
      </Badge>
    );
  }
  if (po.overdueBucket === "not_due") {
    return (
      <Badge
        variant="secondary"
        className="bg-healthy/10 text-healthy text-[10px]"
      >
        On track
      </Badge>
    );
  }
  return null;
}

export function POTable() {
  const { filteredPOs } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("poDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...filteredPOs];
    arr.sort((a, b) => {
      let cmp = 0;
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredPOs, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function SortableHead({
    label,
    sortKeyName,
    className,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) {
    return (
      <TableHead className={className}>
        <button
          onClick={() => toggleSort(sortKeyName)}
          className="flex items-center gap-1 text-xs hover:text-foreground transition-colors"
        >
          {label}
          <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
        </button>
      </TableHead>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          All Purchase Orders
        </CardTitle>
        <p className="text-xs text-muted-foreground font-tabular">
          {sorted.length} records
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs pl-4 w-[60px]">Dir</TableHead>
                <TableHead className="text-xs">PO #</TableHead>
                <SortableHead label="PO Date" sortKeyName="poDate" />
                <SortableHead label="Due Date" sortKeyName="dueDate" />
                <TableHead className="text-xs max-w-[250px]">
                  Description
                </TableHead>
                <SortableHead label="Supplier" sortKeyName="supplier" />
                <SortableHead label="Customer" sortKeyName="customer" />
                <SortableHead
                  label="Qty"
                  sortKeyName="qty"
                  className="text-right"
                />
                <SortableHead
                  label="Value"
                  sortKeyName="total"
                  className="text-right"
                />
                <SortableHead
                  label="Age"
                  sortKeyName="ageDays"
                  className="text-right"
                />
                <TableHead className="text-xs pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((po) => (
                <TableRow
                  key={po.id}
                  className={
                    po.urgency === "most_urgent"
                      ? "bg-warning/4"
                      : po.overdueDays > 0
                        ? "bg-overdue/4"
                        : ""
                  }
                >
                  <TableCell className="pl-4 py-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal"
                    >
                      {po.direction === "incoming" ? "IN" : "OUT"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono font-tabular py-2 whitespace-nowrap">
                    {po.poNumber || "—"}
                  </TableCell>
                  <TableCell className="text-xs font-tabular py-2 whitespace-nowrap">
                    {po.poDate || "—"}
                  </TableCell>
                  <TableCell className="text-xs font-tabular py-2 whitespace-nowrap">
                    {po.dueDate || po.deliveryText || "—"}
                  </TableCell>
                  <TableCell className="text-xs py-2 max-w-[250px] truncate">
                    {po.description}
                  </TableCell>
                  <TableCell className="text-xs py-2 whitespace-nowrap">
                    {po.supplier || "—"}
                  </TableCell>
                  <TableCell className="text-xs py-2 whitespace-nowrap">
                    {po.customer || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-tabular py-2">
                    {po.qty || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono font-tabular py-2 whitespace-nowrap">
                    {po.total > 0 ? formatINRFull(po.total) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-tabular py-2">
                    {po.poDate ? `${po.ageDays}d` : "—"}
                  </TableCell>
                  <TableCell className="pr-4 py-2">
                    <StatusBadge po={po} />
                  </TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground py-12 text-sm"
                  >
                    No purchase orders match the current filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground font-tabular">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
