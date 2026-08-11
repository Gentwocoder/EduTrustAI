"use client";

import dynamic from "next/dynamic";

const LifecycleDashboardClient = dynamic(
  () => import("@/components/lifecycle-dashboard-client").then((module) => module.LifecycleDashboardClient),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
        <div><span className="text-sm font-semibold text-slate-800">Preparing lifecycle controls…</span><p className="mt-1 text-xs text-slate-500">Checking the selected BOT Chain registry version.</p></div>
      </main>
    ),
  },
);

export function LifecycleDashboard() {
  return <LifecycleDashboardClient />;
}
