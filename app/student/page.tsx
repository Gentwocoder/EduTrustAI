import type { Metadata } from "next";
import { StudentWalletDashboard } from "@/components/student-wallet-dashboard";

export const metadata: Metadata = {
  title: "Student Credential Wallet — EduTrust AI",
  description: "Collect credential references and create time-limited, wallet-signed verification links.",
};

export default function StudentWalletPage() {
  return <StudentWalletDashboard />;
}
