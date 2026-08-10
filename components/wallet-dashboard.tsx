"use client";

import dynamic from "next/dynamic";

const WalletDashboardClient = dynamic(
  () => import("@/components/wallet-dashboard-client").then((module) => module.WalletDashboardClient),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
        <div><span className="text-sm font-semibold text-slate-800">Preparing wallet access…</span><p className="mt-1 text-xs text-slate-500">Loading the secure issuer workspace.</p></div>
      </main>
    ),
  },
);

export function WalletDashboard() {
  return <WalletDashboardClient />;
}
