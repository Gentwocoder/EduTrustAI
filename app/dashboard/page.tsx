import type { Metadata } from "next";
import { IssuerDashboard } from "@/components/issuer-dashboard";

export const metadata: Metadata = { title: "Institution Portal — EduTrust AI" };

export default function DashboardPage() {
  return <IssuerDashboard />;
}
