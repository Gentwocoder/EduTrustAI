import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { VerificationDemo } from "@/components/verification-demo";
import { AlertCircleIcon, ShieldCheckIcon } from "@/components/icons";
import { validateCredentialShareToken } from "@/lib/credential-share";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared Credential Verification — EduTrust AI",
  description: "A time-limited, wallet-signed academic credential presentation.",
};

function shortAddress(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default async function SharedCredentialPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const validation = validateCredentialShareToken(token);

  if (!validation.valid && validation.reason === "invalid") notFound();

  if (!validation.valid) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6"><Link href="/"><Brand /></Link><Link href="/" className="text-sm font-semibold text-blue-700">Public verifier</Link></div></header>
        <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlertCircleIcon className="size-6" /></span>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">This verification link has expired</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Ask the presenter to create a new controlled link, or verify directly with the institution-issued credential ID.</p>
          <Link href="/" className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Open public verifier</Link>
        </section>
      </main>
    );
  }

  const { payload } = validation;
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="EduTrust AI home"><Brand /></Link>
          <Link href="/student" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Student wallet</Link>
        </div>
      </header>
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3"><ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-blue-700" /><div><h1 className="text-sm font-semibold text-slate-950">Wallet-signed credential presentation</h1><p className="mt-1 text-xs leading-5 text-slate-600">Presented by <span className="font-mono font-semibold">{shortAddress(payload.presenter)}</span>. Link expires {new Date(payload.expiresAt * 1000).toLocaleString()}.</p></div></div>
          <p className="mt-3 border-t border-blue-200 pt-3 text-xs leading-5 text-slate-600">The signature proves which wallet created this link. Because the current registry does not store recipient addresses, it is not proof that the presenter owns the academic credential.</p>
        </div>
        <VerificationDemo initialCredentialId={payload.credentialIdHash} initialNetworkKey={payload.network} autoVerify />
      </section>
    </main>
  );
}
