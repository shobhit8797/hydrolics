"use client";

import { useDashboard } from "@/lib/store";
import { computeKPIs, formatINR } from "@/lib/computations";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  IndianRupee,
  AlertTriangle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

export function KPICards() {
  const { filteredPOs } = useDashboard();
  const kpis = computeKPIs(filteredPOs);

  const cards = [
    {
      label: "Total Pending Value",
      value: formatINR(kpis.totalPendingValue),
      sub: `In: ${formatINR(kpis.incomingValue)} · Out: ${formatINR(kpis.outgoingValue)}`,
      icon: IndianRupee,
      color: "text-chart-1",
      bg: "bg-chart-1/8",
    },
    {
      label: "Purchase Orders",
      value: kpis.totalPOCount.toLocaleString("en-IN"),
      sub: `Avg age: ${kpis.avgAgeDays}d`,
      icon: Package,
      color: "text-chart-2",
      bg: "bg-chart-2/8",
    },
    {
      label: "Overdue",
      value: kpis.overdueCount.toLocaleString("en-IN"),
      sub: `of ${kpis.totalPOCount} orders`,
      icon: Clock,
      color: "text-overdue",
      bg: "bg-overdue/8",
    },
    {
      label: "Most Urgent",
      value: kpis.urgentCount.toLocaleString("en-IN"),
      sub: "flagged items",
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning/8",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="border-0 shadow-sm py-4">
          <CardContent className="px-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {c.label}
                </p>
                <p className="text-2xl font-semibold font-tabular tracking-tight">
                  {c.value}
                </p>
                <p className="text-xs text-muted-foreground font-tabular">
                  {c.sub}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DirectionSplit() {
  const { filteredPOs } = useDashboard();
  const incoming = filteredPOs.filter((p) => p.direction === "incoming");
  const outgoing = filteredPOs.filter((p) => p.direction === "outgoing");
  const inVal = incoming.reduce((s, p) => s + p.total, 0);
  const outVal = outgoing.reduce((s, p) => s + p.total, 0);

  return (
    <div className="flex gap-3">
      <Card className="flex-1 border-0 shadow-sm py-3">
        <CardContent className="px-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-chart-3/10">
            <ArrowDownLeft className="h-4 w-4 text-chart-3" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Incoming</p>
            <p className="text-sm font-semibold font-tabular">
              {incoming.length} POs · {formatINR(inVal)}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="flex-1 border-0 shadow-sm py-3">
        <CardContent className="px-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-chart-4/10">
            <ArrowUpRight className="h-4 w-4 text-chart-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outgoing</p>
            <p className="text-sm font-semibold font-tabular">
              {outgoing.length} POs · {formatINR(outVal)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
