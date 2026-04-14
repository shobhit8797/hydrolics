"use client";

import { useDashboard } from "@/lib/store";
import {
  computeCompanySummaries,
  formatINR,
  formatINRFull,
} from "@/lib/computations";
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
import { Building2, Users } from "lucide-react";

export function CompanyTable() {
  const { filteredPOs, filters, updateFilter, setDrilldownCompany } =
    useDashboard();
  const view = filters.companyView;

  const summaries = computeCompanySummaries(filteredPOs, view);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Company Overview
        </CardTitle>
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={view === "supplier" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs gap-1 px-2"
            onClick={() => updateFilter("companyView", "supplier")}
          >
            <Building2 className="h-3 w-3" />
            Supplier
          </Button>
          <Button
            variant={view === "customer" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs gap-1 px-2"
            onClick={() => updateFilter("companyView", "customer")}
          >
            <Users className="h-3 w-3" />
            Customer
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs pl-4">Company</TableHead>
                <TableHead className="text-xs text-right">POs</TableHead>
                <TableHead className="text-xs text-right">Value</TableHead>
                <TableHead className="text-xs text-right">Avg Age</TableHead>
                <TableHead className="text-xs text-right">Overdue</TableHead>
                <TableHead className="text-xs text-right pr-4">Urgent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((s) => (
                <TableRow
                  key={s.name}
                  className="cursor-pointer"
                  onClick={() => {
                    setDrilldownCompany(s.name);
                    if (view === "supplier") {
                      updateFilter("suppliers", [s.name]);
                    } else {
                      updateFilter("customers", [s.name]);
                    }
                  }}
                >
                  <TableCell className="text-sm font-medium pl-4 py-2.5">
                    {s.name}
                  </TableCell>
                  <TableCell className="text-sm text-right font-tabular py-2.5">
                    {s.poCount}
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono font-tabular py-2.5">
                    {formatINR(s.totalValue)}
                  </TableCell>
                  <TableCell className="text-sm text-right font-tabular py-2.5">
                    {s.avgAgeDays}d
                  </TableCell>
                  <TableCell className="text-sm text-right py-2.5">
                    {s.overdueCount > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-overdue/10 text-overdue text-xs"
                      >
                        {s.overdueCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-right pr-4 py-2.5">
                    {s.urgentCount > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-warning/10 text-warning text-xs"
                      >
                        {s.urgentCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {summaries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8 text-sm"
                  >
                    No data matches the current filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
