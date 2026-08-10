"use client";

import { IssuerDashboard } from "@/components/issuer-dashboard";
import { WalletProvider } from "@/components/wallet-provider";

export function WalletDashboardClient() {
  return <WalletProvider><IssuerDashboard /></WalletProvider>;
}
