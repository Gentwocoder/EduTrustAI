import Link from "next/link";
import { isHexString } from "ethers";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { VerificationDemo } from "@/components/verification-demo";
import { isBotNetworkKey } from "@/lib/registry";

export default async function CredentialVerificationPage({
  params,
}: {
  params: Promise<{ network: string; credential: string }>;
}) {
  const { network, credential } = await params;
  if (!isBotNetworkKey(network) || !isHexString(credential, 32)) notFound();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="EduTrust AI home"><Brand /></Link>
          <Link href="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Public verifier</Link>
        </div>
      </header>
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">QR verification</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Check this credential</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">EduTrust will read the credential directly from the selected BOT Chain registry.</p>
        </div>
        <VerificationDemo
          initialCredentialId={credential}
          initialNetworkKey={network}
          autoVerify
        />
      </section>
    </main>
  );
}
