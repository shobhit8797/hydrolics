"use client";

import type { POWithComputed } from "@/lib/types";
import { DashboardProvider } from "./dashboard-provider";
import { KPICards, DirectionSplit } from "./kpi-cards";
import { FilterBar } from "./filters";
import { AgingBucketChart, OverdueBucketChart } from "./aging-chart";
import { CompanyTable } from "./company-table";
import { POTable } from "./po-table";
import { TimelineChart } from "./timeline-chart";
import { EmailTab } from "./email-tab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Package, Mail, ClipboardList } from "lucide-react";

interface Props {
  allPOs: POWithComputed[];
  uniqueSuppliers: string[];
  uniqueCustomers: string[];
}

export function Dashboard({ allPOs, uniqueSuppliers, uniqueCustomers }: Props) {
  return (
    <DashboardProvider
      allPOs={allPOs}
      uniqueSuppliers={uniqueSuppliers}
      uniqueCustomers={uniqueCustomers}
    >
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary">
                <Package className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight leading-none">
                  Pending Orders
                </h1>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  GH Purchase Order Tracker
                </p>
              </div>
            </div>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <p className="text-[10px] text-muted-foreground font-mono font-tabular">
              {allPOs.length} records · Last parsed{" "}
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </header>

        {/* Tabbed Content */}
        <Tabs defaultValue="orders">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-3">
            <TabsList variant="line">
              <TabsTrigger value="orders">
                <ClipboardList className="size-3.5" data-icon="inline-start" />
                PO Orders
              </TabsTrigger>
              <TabsTrigger value="emails">
                <Mail className="size-3.5" data-icon="inline-start" />
                PO Emails
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="orders">
            <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 space-y-4">
              <FilterBar />
              <KPICards />
              <DirectionSplit />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AgingBucketChart />
                <OverdueBucketChart />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                  <CompanyTable />
                </div>
                <div className="lg:col-span-2">
                  <TimelineChart />
                </div>
              </div>

              <POTable />
            </main>
          </TabsContent>

          <TabsContent value="emails">
            <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
              <EmailTab />
            </main>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardProvider>
  );
}
