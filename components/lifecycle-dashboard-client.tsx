"use client";

import { LifecycleManager } from "@/components/lifecycle-manager";
import { WalletProvider } from "@/components/wallet-provider";

export function LifecycleDashboardClient() {
  return <WalletProvider><LifecycleManager /></WalletProvider>;
}
