"use client";

import { useMemo } from "react";
import { useDashboard } from "@/lib/store";
import { formatINR } from "@/lib/computations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartWrapper } from "./chart-wrapper";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts";

interface DataPoint {
  x: number;
  y: number;
  poDate: string;
  dueDate: string;
  total: number;
  description: string;
  overdue: boolean;
  r: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DataPoint }>;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg text-xs max-w-[250px]">
      <p className="font-medium truncate">{d.description}</p>
      <p className="text-muted-foreground mt-1">
        PO: {d.poDate} → Due: {d.dueDate}
      </p>
      <p className="text-muted-foreground">Value: {formatINR(d.total)}</p>
      {d.overdue && (
        <p className="text-overdue font-medium mt-0.5">Overdue</p>
      )}
    </div>
  );
}

export function TimelineChart() {
  const { filteredPOs } = useDashboard();

  const data = useMemo(() => {
    const points: { overdue: DataPoint[]; onTrack: DataPoint[] } = {
      overdue: [],
      onTrack: [],
    };

    for (const po of filteredPOs) {
      if (!po.poDate || !po.dueDate) continue;

      const poMs = new Date(po.poDate).getTime();
      const dueMs = new Date(po.dueDate).getTime();
      if (isNaN(poMs) || isNaN(dueMs)) continue;

      const point: DataPoint = {
        x: poMs,
        y: dueMs,
        poDate: po.poDate,
        dueDate: po.dueDate,
        total: po.total,
        description: po.description,
        overdue: po.overdueDays > 0,
        r: Math.max(3, Math.min(12, Math.sqrt(po.total / 10000))),
      };

      if (po.overdueDays > 0) {
        points.overdue.push(point);
      } else {
        points.onTrack.push(point);
      }
    }

    return points;
  }, [filteredPOs]);

  const allPoints = [...data.onTrack, ...data.overdue];

  if (allPoints.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            PO Date vs Due Date
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
            No POs with both PO Date and Due Date available
          </div>
        </CardContent>
      </Card>
    );
  }

  const xMin = Math.min(...allPoints.map((p) => p.x));
  const xMax = Math.max(...allPoints.map((p) => p.x));
  const yMin = Math.min(...allPoints.map((p) => p.y));
  const yMax = Math.max(...allPoints.map((p) => p.y));

  const formatDate = (v: number) => {
    const d = new Date(v);
    return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          PO Date vs Due Date
        </CardTitle>
        <div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-chart-2" />
            On track ({data.onTrack.length})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-overdue" />
            Overdue ({data.overdue.length})
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ChartWrapper height="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis
                type="number"
                dataKey="x"
                domain={[xMin, xMax]}
                tickFormatter={formatDate}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                name="PO Date"
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[yMin, yMax]}
                tickFormatter={formatDate}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                name="Due Date"
                width={40}
              />
              <ZAxis type="number" dataKey="r" range={[20, 200]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter
                data={data.onTrack}
                fill="oklch(0.55 0.15 200)"
                fillOpacity={0.5}
              />
              <Scatter
                data={data.overdue}
                fill="oklch(0.55 0.22 25)"
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </CardContent>
    </Card>
  );
}
