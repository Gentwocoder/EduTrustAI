"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BrowserProvider, Contract, id as hashText, sha256 } from "ethers";
import { Brand } from "@/components/brand";
import { BOT_TESTNET, REGISTRY_ABI, REGISTRY_ADDRESS, registryExplorerUrl } from "@/lib/registry";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type Activity = {
  credentialId: string;
  documentHash: string;
  transactionHash: string;
  confirmedAt: string;
};

const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
const labelClass = "text-xs font-semibold text-slate-700";

function shortValue(value: string, start = 8, end = 6) {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function NavIcon({ children }: { children: string }) {
  return <span className="grid size-5 place-items-center text-sm" aria-hidden="true">{children}</span>;
}

export function IssuerDashboard() {
  const [view, setView] = useState<"overview" | "issue">("overview");
  const [account, setAccount] = useState("");
  const [documentHash, setDocumentHash] = useState("");
  const [fileName, setFileName] = useState("");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" })
      .then((accounts) => {
        const [first] = accounts as string[];
        if (first) setAccount(first);
      })
      .catch(() => undefined);
  }, []);

  async function getSigner() {
    if (!window.ethereum) {
      throw new Error("Install MetaMask or another EVM wallet to issue credentials.");
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BOT_TESTNET.chainIdHex }],
      });
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== 4902) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BOT_TESTNET.chainIdHex,
          chainName: BOT_TESTNET.name,
          nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
          rpcUrls: [BOT_TESTNET.rpcUrl],
          blockExplorerUrls: [BOT_TESTNET.explorerUrl],
        }],
      });
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setAccount(address);
    return signer;
  }

  async function connectWallet() {
    setConnecting(true);
    setNotice(null);
    try {
      await getSigner();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The wallet could not be connected." });
    } finally {
      setConnecting(false);
    }
  }

  async function selectDocument(file?: File) {
    setDocumentHash("");
    setFileName("");
    if (!file) return;
    const digest = sha256(new Uint8Array(await file.arrayBuffer()));
    setDocumentHash(digest);
    setFileName(file.name);
  }

  async function issueCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const credentialId = String(data.get("credentialId") ?? "").trim();

    if (!documentHash) {
      setNotice({ tone: "error", text: "Choose the source document before issuing the credential." });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const signer = await getSigner();
      const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const transaction = await registry.issueCredential(hashText(credentialId), documentHash);
      const receipt = await transaction.wait();
      const transactionHash = receipt?.hash ?? transaction.hash;
      setActivity((current) => [{
        credentialId,
        documentHash,
        transactionHash,
        confirmedAt: new Date().toLocaleString(),
      }, ...current]);
      form.reset();
      setDocumentHash("");
      setFileName("");
      setView("overview");
      setNotice({ tone: "success", text: `${credentialId} was confirmed on BOT Testnet.` });
    } catch (error) {
      const reason = error instanceof Error && error.message.includes("AccessControlUnauthorizedAccount")
        ? "This wallet is not authorised as an issuer on the registry contract."
        : error instanceof Error ? error.message : "The transaction could not be completed.";
      setNotice({ tone: "error", text: reason });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 lg:px-5">
          <Link href="/" aria-label="EduTrust AI home"><Brand /></Link>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Issuer</span>
        </div>

        <div className="hidden h-[calc(100vh-4rem)] flex-col p-3 lg:flex">
          <div className="mb-4 rounded-lg border border-slate-200 p-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Wallet access</span>
            <strong className="mt-2 block truncate font-mono text-xs text-slate-900">{account ? shortValue(account) : "Not connected"}</strong>
            <span className={`mt-1 block text-[11px] ${account ? "text-emerald-700" : "text-slate-500"}`}>{account ? "Connected to issuer workspace" : "Connect an authorised wallet"}</span>
          </div>

          <nav className="space-y-1" aria-label="Institution portal">
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${view === "overview" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`} onClick={() => setView("overview")}><NavIcon>⌂</NavIcon>Overview</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${view === "issue" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`} onClick={() => setView("issue")}><NavIcon>＋</NavIcon>Issue credential</button>
            <a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" href={registryExplorerUrl()} target="_blank" rel="noreferrer"><NavIcon>↗</NavIcon>BOT explorer</a>
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deployment network</span><span className="size-2 rounded-full bg-emerald-500" /></div>
              <strong className="mt-2 block text-xs font-semibold text-slate-800">{BOT_TESTNET.name}</strong>
              <span className="mt-1 block font-mono text-[11px] text-slate-500">Chain ID {BOT_TESTNET.chainId}</span>
            </div>
            <Link className="block px-2 text-xs font-medium text-slate-500 hover:text-slate-900" href="/">← Back to public site</Link>
          </div>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Institution portal</p><h1 className="mt-0.5 text-sm font-semibold text-slate-900">{view === "overview" ? "Credential registry" : "Issue a credential"}</h1></div>
          <button className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:text-slate-400" onClick={connectWallet} disabled={connecting}>
            {connecting ? "Connecting…" : account ? shortValue(account, 6, 4) : "Connect wallet"}
          </button>
        </header>

        {notice && <div className={`mx-4 mt-4 flex items-center gap-3 rounded-lg border px-4 py-3 text-xs font-medium sm:mx-6 lg:mx-8 ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} role={notice.tone === "error" ? "alert" : "status"}><span className={`grid size-5 place-items-center rounded-full text-[10px] text-white ${notice.tone === "success" ? "bg-emerald-600" : "bg-red-600"}`}>{notice.tone === "success" ? "✓" : "!"}</span><span className="min-w-0 flex-1 break-words">{notice.text}</span><button className="rounded p-1 hover:bg-black/5" onClick={() => setNotice(null)} aria-label="Dismiss notification">×</button></div>}

        {view === "overview" ? (
          <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-xs font-semibold text-blue-700">BOT Chain registry</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Credential activity</h2><p className="mt-1 text-sm text-slate-600">Connect an authorised wallet to issue credentials. Confirmed transactions from this session appear below.</p></div>
              <button className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" onClick={() => setView("issue")}>＋ <span className="ml-1">Issue credential</span></button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-medium text-slate-500">Issuer wallet</span><strong className="mt-2 block font-mono text-sm text-slate-950">{account ? shortValue(account) : "Not connected"}</strong><span className="mt-1 block text-[11px] text-slate-500">{account ? "Wallet connection active" : "Required for signed transactions"}</span></article>
              <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-medium text-slate-500">Registry contract</span><a href={registryExplorerUrl()} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-sm font-semibold text-blue-700 hover:underline">{shortValue(REGISTRY_ADDRESS)} ↗</a><span className="mt-1 block text-[11px] text-slate-500">{BOT_TESTNET.name}</span></article>
              <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-medium text-slate-500">Confirmed this session</span><strong className="mt-1 block text-2xl font-semibold tracking-tight text-slate-950">{activity.length}</strong><span className="mt-1 block text-[11px] text-slate-500">Based only on transactions completed here</span></article>
            </div>

            <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-semibold text-slate-900">Session activity</h3><p className="mt-1 text-xs text-slate-500">Confirmed issuance transactions created from this browser session</p></div>
              {activity.length === 0 ? (
                <div className="px-5 py-14 text-center"><span className="mx-auto grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-500">#</span><h4 className="mt-3 text-sm font-semibold text-slate-900">No issuance activity yet</h4><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">Records will appear here after an authorised wallet confirms an issuance transaction.</p><button onClick={() => setView("issue")} className="mt-4 text-xs font-semibold text-blue-700 hover:underline">Issue the first credential</button></div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><thead><tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Credential ID</th><th className="px-5 py-3">Document fingerprint</th><th className="px-5 py-3">Confirmed</th><th className="px-5 py-3 text-right">Transaction</th></tr></thead><tbody className="divide-y divide-slate-100">{activity.map((item) => <tr className="text-xs text-slate-700" key={item.transactionHash}><td className="px-5 py-4 font-mono font-semibold text-slate-900">{item.credentialId}</td><td className="px-5 py-4 font-mono">{shortValue(item.documentHash)}</td><td className="px-5 py-4 text-slate-500">{item.confirmedAt}</td><td className="px-5 py-4 text-right"><a className="font-semibold text-blue-700 hover:underline" href={`${BOT_TESTNET.explorerUrl}/tx/${item.transactionHash}`} target="_blank" rel="noreferrer">View ↗</a></td></tr>)}</tbody></table></div>
              )}
            </section>
          </div>
        ) : (
          <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
            <button className="mb-5 inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-950" onClick={() => setView("overview")}>← Back to registry</button>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
              <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={issueCredential}>
                <div className="border-b border-slate-200 pb-5"><p className="text-xs font-semibold text-blue-700">New registry entry</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Issue credential</h2><p className="mt-1 text-sm text-slate-600">The wallet signs a transaction containing only one-way fingerprints.</p></div>
                <div className="mt-6 space-y-5">
                  <label className={labelClass}>Credential ID<input className={`${inputClass} font-mono`} name="credentialId" required placeholder="Enter the institution-issued identifier" autoComplete="off" /></label>
                  <label className={labelClass}>Source document<span className="mt-1 block text-[11px] font-normal leading-5 text-slate-500">The file stays on this device. EduTrust calculates its SHA-256 fingerprint locally.</span><input className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700`} name="document" type="file" accept="application/pdf,image/*" required onChange={(event) => selectDocument(event.target.files?.[0])} /></label>
                  <label className={labelClass}>Document fingerprint<input className={`${inputClass} font-mono text-slate-500`} readOnly value={documentHash} placeholder="Calculated after a document is selected" /></label>
                </div>
                <div className="mt-5 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"><span className="font-bold">✓</span><p><strong>Privacy-preserving issuance.</strong> The selected document and its contents are never uploaded by this interface.</p></div>
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setView("overview")}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-wait disabled:bg-blue-400" disabled={submitting}>{submitting ? "Waiting for confirmation…" : account ? "Issue credential" : "Connect wallet and issue"}</button></div>
              </form>

              <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white"><Image src="/favicon.svg" alt="" width={24} height={24} /></span><span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">Testnet</span></div>
                <h3 className="mt-5 text-sm font-semibold text-slate-900">Transaction preview</h3><p className="mt-1 text-xs leading-5 text-slate-500">Review the public destination before approving the wallet request.</p>
                <dl className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-[11px] text-slate-500">Network</dt><dd className="text-right text-[11px] font-semibold text-slate-800">{BOT_TESTNET.name}</dd></div>
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-[11px] text-slate-500">Chain ID</dt><dd className="font-mono text-[11px] font-semibold text-slate-800">{BOT_TESTNET.chainId}</dd></div>
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-[11px] text-slate-500">Issuer</dt><dd className="max-w-[160px] text-right font-mono text-[11px] font-semibold text-slate-800">{account ? shortValue(account) : "Not connected"}</dd></div>
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-[11px] text-slate-500">Contract</dt><dd className="max-w-[160px] text-right font-mono text-[11px] font-semibold text-slate-800">{shortValue(REGISTRY_ADDRESS)}</dd></div>
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-[11px] text-slate-500">Document</dt><dd className="max-w-[160px] truncate text-right font-mono text-[11px] font-semibold text-slate-800" title={documentHash}>{documentHash ? shortValue(documentHash) : fileName || "Not selected"}</dd></div>
                </dl>
                <div className="mt-4 rounded-lg bg-slate-50 p-3"><strong className="text-[11px] font-semibold text-slate-800">Never written on-chain</strong><p className="mt-1 text-[11px] leading-5 text-slate-500">Student name · Grade · Certificate file · Contact details</p></div>
              </aside>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
