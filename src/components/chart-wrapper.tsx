"use client";

import { useState, useEffect, type ReactNode } from "react";

export function ChartWrapper({
  children,
  height = "h-[200px]",
}: {
  children: ReactNode;
  height?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={`${height} flex items-center justify-center`}>
        <div className="h-4 w-4 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return <div className={height}>{children}</div>;
}
