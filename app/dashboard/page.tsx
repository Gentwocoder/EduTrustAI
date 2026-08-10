import type { Metadata } from "next";
import { WalletDashboard } from "@/components/wallet-dashboard";

export const metadata: Metadata = { title: "Institution Portal — EduTrust AI" };

export default function DashboardPage() {
  return <WalletDashboard />;
}
