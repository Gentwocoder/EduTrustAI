import type { Metadata } from "next";
import { LifecycleDashboard } from "@/components/lifecycle-dashboard";

export const metadata: Metadata = {
  title: "Credential Lifecycle — EduTrust AI",
  description: "Renew, correct and replace credentials or rotate registry administration.",
};

export default function CredentialLifecyclePage() {
  return <LifecycleDashboard />;
}
