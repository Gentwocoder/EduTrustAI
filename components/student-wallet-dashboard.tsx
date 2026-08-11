"use client";

import dynamic from "next/dynamic";

const StudentWalletClient = dynamic(
  () => import("@/components/student-wallet-client").then((module) => module.StudentWalletClient),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
        <div><span className="text-sm font-semibold text-slate-800">Preparing credential wallet…</span><p className="mt-1 text-xs text-slate-500">Loading private browser storage and wallet access.</p></div>
      </main>
    ),
  },
);

export function StudentWalletDashboard() {
  return <StudentWalletClient />;
}
