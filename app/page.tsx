import Link from "next/link";
import { Brand } from "@/components/brand";
import { RegistryOverview } from "@/components/registry-overview";
import { VerificationDemo } from "@/components/verification-demo";

const workflow = [
  { number: "01", title: "Institution issues", body: "An authorised officer creates the academic record and confirms the source document." },
  { number: "02", title: "Fingerprint is registered", body: "EduTrust stores hashes, issuer identity and status on BOT Chain—not student files." },
  { number: "03", title: "Third party verifies", body: "An employer checks the credential ID and receives a clear, auditable result." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <a href="#top" aria-label="EduTrust AI home"><Brand /></a>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a className="transition hover:text-slate-950" href="#verification">Verify</a>
            <a className="transition hover:text-slate-950" href="#how-it-works">How it works</a>
            <a className="transition hover:text-slate-950" href="#institutions">Institutions</a>
          </div>
          <Link className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" href="/dashboard">
            Institution portal
          </Link>
        </nav>
      </header>

      <section id="top" className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-8 lg:py-20">
          <div className="max-w-xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              Academic credential registry
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-[3.4rem] lg:leading-[1.06]">Verify academic records without waiting on the registrar.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">EduTrust gives schools a controlled issuance workspace and gives employers a direct way to confirm credentials against an auditable BOT Chain record.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" href="#verification">Verify a credential</a>
              <Link className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" href="/dashboard">Open issuer workspace</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-5 text-xs text-slate-600">
              <span className="flex items-center gap-2"><b className="text-emerald-600">✓</b> No student files on-chain</span>
              <span className="flex items-center gap-2"><b className="text-emerald-600">✓</b> Role-controlled issuance</span>
              <span className="flex items-center gap-2"><b className="text-emerald-600">✓</b> Permanent audit status</span>
            </div>
          </div>

          <div id="verification" className="scroll-mt-24">
            <div className="mb-3 flex items-center justify-between px-1 text-xs text-slate-500">
              <span className="font-medium">Public verification service</span>
              <span className="font-mono">BOT Mainnet · 677</span>
            </div>
            <VerificationDemo />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50" aria-label="Service metrics">
        <RegistryOverview />
      </section>

      <section id="how-it-works" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Operating model</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">One controlled record from issuance to verification.</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">The system keeps identifiable student data with the institution and publishes only the evidence required to validate integrity and status.</p>
            </div>
            <ol className="grid gap-4 md:grid-cols-3">
              {workflow.map((item) => (
                <li className="rounded-xl border border-slate-200 bg-white p-5" key={item.number}>
                  <span className="font-mono text-xs font-semibold text-blue-700">{item.number}</span>
                  <h3 className="mt-8 text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div><h2 className="text-sm font-semibold text-slate-950">What the public can verify</h2><p className="mt-1 text-xs text-slate-500">Available without signing in</p></div>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Public</span>
            </div>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {["Issuing institution", "Qualification and issue date", "Credential lifecycle status", "Document fingerprint match"].map((item) => <li className="flex items-center justify-between py-3 text-slate-700" key={item}><span>{item}</span><span className="text-emerald-600">✓</span></li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div><h2 className="text-sm font-semibold text-slate-950">What remains private</h2><p className="mt-1 text-xs text-slate-500">Retained by the institution</p></div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Restricted</span>
            </div>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {["Original certificate PDF", "Student email and contact details", "Full academic transcript", "Internal registrar notes"].map((item) => <li className="flex items-center justify-between py-3 text-slate-700" key={item}><span>{item}</span><span className="text-slate-400">—</span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section id="institutions" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-slate-200 bg-slate-950 px-6 py-8 sm:px-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Institution access</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Manage issuance from a focused registrar workspace.</h2><p className="mt-2 text-sm leading-6 text-slate-300">Review registry totals, issue new credentials, revoke compromised records and inspect the chain payload before signing.</p></div>
            <Link className="inline-flex shrink-0 items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-950" href="/dashboard">Open institution portal <span className="ml-2" aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Brand />
          <p>Independent credential verification · Built on BOT Chain</p>
          <p>© 2026 EduTrust AI</p>
        </div>
      </footer>
    </main>
  );
}
