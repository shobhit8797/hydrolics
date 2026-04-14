"use client";

import { useDashboard } from "@/lib/store";
import {
  computeAgingBuckets,
  computeOverdueBuckets,
  formatINR,
} from "@/lib/computations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartWrapper } from "./chart-wrapper";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const AGE_COLORS = [
  "oklch(0.55 0.16 150)",
  "oklch(0.60 0.15 180)",
  "oklch(0.65 0.12 50)",
  "oklch(0.60 0.18 40)",
  "oklch(0.55 0.22 25)",
];

const OVERDUE_COLORS = [
  "oklch(0.55 0.16 150)",
  "oklch(0.70 0.18 70)",
  "oklch(0.65 0.20 50)",
  "oklch(0.58 0.22 35)",
  "oklch(0.55 0.22 25)",
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { bucket: string; count: number; value: number } }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg text-xs">
      <p className="font-medium">{d.bucket}</p>
      <p className="text-muted-foreground mt-1">
        {d.count} POs · {formatINR(d.value)}
      </p>
    </div>
  );
}

export function AgingBucketChart() {
  const { filteredPOs } = useDashboard();
  const data = computeAgingBuckets(filteredPOs);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Age from PO Date
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ChartWrapper>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="20%">
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </CardContent>
    </Card>
  );
}

export function OverdueBucketChart() {
  const { filteredPOs } = useDashboard();
  const data = computeOverdueBuckets(filteredPOs);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Overdue from Due Date
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ChartWrapper>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="20%">
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={OVERDUE_COLORS[i % OVERDUE_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </CardContent>
    </Card>
  );
}
