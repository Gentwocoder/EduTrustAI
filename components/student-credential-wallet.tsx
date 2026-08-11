"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrowserProvider, isHexString } from "ethers";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
  type Provider,
} from "@reown/appkit/react";
import { Brand } from "@/components/brand";
import {
  CheckCircleIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LinkIcon,
  LogOutIcon,
  RefreshIcon,
  TrashIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";
import {
  BOT_NETWORKS,
  registryAddressForNetwork,
  type BotNetworkKey,
} from "@/lib/registry";
import {
  createCredentialShareToken,
  credentialShareMessage,
  type CredentialSharePayload,
} from "@/lib/credential-share";
import { downloadVerificationReceipt } from "@/lib/verification-receipt";

type CredentialStatus = "valid" | "revoked" | "expired" | "replaced" | "unknown";

type RegistryRecord = {
  credentialIdHash: string;
  documentHash: string;
  issuer: string;
  issuedAt: number;
  revokedAt: number;
  expiresAt?: number;
  replacement?: string;
  transactionHash?: string | null;
  status: CredentialStatus;
  institutionProfile: {
    name: string;
  } | null;
};

type SavedCredential = RegistryRecord & {
  networkKey: BotNetworkKey;
  savedAt: string;
};

const storagePrefix = "edutrust:student-wallet:v1:";

function storageKey(address: string) {
  return `${storagePrefix}${address.toLowerCase()}`;
}

function readCredentials(address: string) {
  try {
    const saved = window.localStorage.getItem(storageKey(address));
    return saved ? JSON.parse(saved) as SavedCredential[] : [];
  } catch {
    return [];
  }
}

function persistCredentials(address: string, credentials: SavedCredential[]) {
  window.localStorage.setItem(storageKey(address), JSON.stringify(credentials));
}

function shortValue(value: string, start = 8, end = 6) {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function statusClass(status: CredentialStatus) {
  if (status === "valid") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "revoked") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "expired" || status === "replaced") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

export function StudentCredentialWallet() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { walletProvider } = useAppKitProvider<Provider>("eip155");
  const { disconnect } = useDisconnect();
  const account = address ?? "";
  const [credentials, setCredentials] = useState<SavedCredential[]>([]);
  const [networkKey, setNetworkKey] = useState<BotNetworkKey>("mainnet");
  const [credentialId, setCredentialId] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState("");
  const [shareTarget, setShareTarget] = useState<SavedCredential | null>(null);
  const [shareDays, setShareDays] = useState(7);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!account) {
      setCredentials([]);
      return;
    }
    setCredentials(readCredentials(account));
  }, [account]);

  const totals = useMemo(() => ({
    valid: credentials.filter((item) => item.status === "valid").length,
    attention: credentials.filter((item) => item.status !== "valid").length,
  }), [credentials]);

  function save(next: SavedCredential[]) {
    setCredentials(next);
    if (account) persistCredentials(account, next);
  }

  async function fetchCredential(candidate: string, selectedNetwork: BotNetworkKey) {
    const response = await fetch(
      `/api/registry?network=${selectedNetwork}&credentialId=${encodeURIComponent(candidate)}`,
    );
    const data = await response.json() as RegistryRecord & { message?: string };
    if (!response.ok) throw new Error(data.message ?? "The credential could not be loaded.");
    return data;
  }

  async function addCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) {
      await open({ view: "Connect", namespace: "eip155" });
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const record = await fetchCredential(credentialId.trim(), networkKey);
      if (record.status === "unknown") {
        throw new Error("No credential was found for that ID on the selected BOT Chain network.");
      }
      const duplicate = credentials.some((item) => (
        item.networkKey === networkKey &&
        item.credentialIdHash.toLowerCase() === record.credentialIdHash.toLowerCase()
      ));
      if (duplicate) throw new Error("This credential is already saved in your wallet.");

      save([{
        ...record,
        networkKey,
        savedAt: new Date().toISOString(),
      }, ...credentials]);
      setCredentialId("");
      setTone("success");
      setMessage("Credential saved to this wallet-scoped browser collection.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The credential could not be added.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshCredential(item: SavedCredential) {
    setRefreshing(item.credentialIdHash);
    setMessage("");
    try {
      const record = await fetchCredential(item.credentialIdHash, item.networkKey);
      const next = credentials.map((saved) => (
        saved.networkKey === item.networkKey &&
        saved.credentialIdHash.toLowerCase() === item.credentialIdHash.toLowerCase()
          ? { ...saved, ...record }
          : saved
      ));
      save(next);
      setTone("success");
      setMessage("Credential status refreshed from BOT Chain.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The credential could not be refreshed.");
    } finally {
      setRefreshing("");
    }
  }

  function removeCredential(item: SavedCredential) {
    save(credentials.filter((saved) => !(
      saved.networkKey === item.networkKey &&
      saved.credentialIdHash.toLowerCase() === item.credentialIdHash.toLowerCase()
    )));
  }

  async function createShareLink() {
    if (!shareTarget || !walletProvider || !account || !isConnected) return;
    setSharing(true);
    setShareUrl("");
    setMessage("");
    try {
      const payload: CredentialSharePayload = {
        version: 1,
        network: shareTarget.networkKey,
        credentialIdHash: shareTarget.credentialIdHash,
        presenter: account,
        expiresAt: Math.floor(Date.now() / 1000) + shareDays * 24 * 60 * 60,
      };
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(credentialShareMessage(payload));
      const token = createCredentialShareToken(payload, signature);
      setShareUrl(`${window.location.origin}/share/${token}`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The share link could not be signed.");
    } finally {
      setSharing(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  function downloadReceipt(item: SavedCredential) {
    const network = BOT_NETWORKS[item.networkKey];
    downloadVerificationReceipt({
      credentialIdHash: item.credentialIdHash,
      status: item.status,
      issuer: item.issuer,
      institution: item.institutionProfile?.name ?? "Authorised issuer",
      documentCheck: "Not supplied",
      network: network.name,
      chainId: network.chainId,
      registryAddress: registryAddressForNetwork(item.networkKey),
      transactionHash: item.transactionHash,
      issuedAt: item.issuedAt,
      expiresAt: item.expiresAt,
      replacement: item.replacement,
      verifiedAt: new Date(),
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="EduTrust AI home"><Brand /></Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex">Public verifier</Link>
            {account ? (
              <>
                <span className="hidden rounded-md bg-slate-100 px-2.5 py-2 font-mono text-xs font-semibold text-slate-700 md:inline-flex">{shortValue(account, 6, 4)}</span>
                <button onClick={() => disconnect({ namespace: "eip155" })} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><LogOutIcon className="size-4" />Disconnect</button>
              </>
            ) : (
              <button onClick={() => open({ view: "Connect", namespace: "eip155" })} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"><WalletIcon className="size-4" />Connect wallet</button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Recipient workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Student credential wallet</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Collect public credential references in a wallet-scoped browser dashboard, refresh their live status, and create signed verification links that expire automatically.</p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3"><span className="text-xs text-slate-500">Valid</span><strong className="ml-3 text-lg text-emerald-700">{totals.valid}</strong></div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3"><span className="text-xs text-slate-500">Attention</span><strong className="ml-3 text-lg text-amber-700">{totals.attention}</strong></div>
          </div>
        </div>

        {message && (
          <div className={`mt-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} role={tone === "error" ? "alert" : "status"}>
            {tone === "success" ? <CheckCircleIcon className="mt-0.5 size-4 shrink-0" /> : <XIcon className="mt-0.5 size-4 shrink-0" />}
            <span>{message}</span>
          </div>
        )}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={addCredential} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><FileTextIcon className="size-5" /></span>
            <h2 className="mt-4 text-base font-semibold text-slate-950">Add a credential</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Enter the ID supplied by the institution. EduTrust stores only the resulting public hash in this collection.</p>
            <label className="mt-5 block text-xs font-semibold text-slate-700">Network
              <select value={networkKey} onChange={(event) => setNetworkKey(event.target.value as BotNetworkKey)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
                <option value="mainnet">BOT Chain Mainnet</option>
                <option value="testnet">BOT Chain Testnet</option>
              </select>
            </label>
            <label className="mt-4 block text-xs font-semibold text-slate-700">Credential ID
              <input value={credentialId} onChange={(event) => setCredentialId(event.target.value)} required autoComplete="off" placeholder="Enter credential ID" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            </label>
            <button disabled={loading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400">{loading ? "Checking registry…" : "Save credential"}</button>
            <p className="mt-3 text-xs leading-5 text-slate-500">This is a personal organiser, not an on-chain ownership claim. The current registry does not publish student wallet addresses.</p>
          </form>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-base font-semibold text-slate-950">Saved credentials</h2><p className="mt-1 text-sm text-slate-500">Public registry evidence saved on this browser for {account ? shortValue(account) : "the connected wallet"}</p></div>
            {!account ? (
              <div className="px-5 py-16 text-center"><WalletIcon className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 text-base font-semibold text-slate-900">Connect your wallet</h3><p className="mt-1 text-sm text-slate-500">Your collection is separated by connected wallet address.</p></div>
            ) : credentials.length === 0 ? (
              <div className="px-5 py-16 text-center"><FileTextIcon className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 text-base font-semibold text-slate-900">No saved credentials</h3><p className="mt-1 text-sm text-slate-500">Add the first institution-issued credential ID.</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {credentials.map((item) => {
                  const network = BOT_NETWORKS[item.networkKey];
                  return (
                    <article className="p-5" key={`${item.networkKey}:${item.credentialIdHash}`}>
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusClass(item.status)}`}>{item.status}</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{network.shortName}</span>
                          </div>
                          <h3 className="mt-3 text-sm font-semibold text-slate-950">{item.institutionProfile?.name ?? "Authorised issuer"}</h3>
                          <p className="mt-1 font-mono text-xs text-slate-500" title={item.credentialIdHash}>{shortValue(item.credentialIdHash, 12, 10)}</p>
                          <p className="mt-2 text-xs text-slate-500">Issued {item.issuedAt ? new Date(item.issuedAt * 1000).toLocaleString() : "date unavailable"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => refreshCredential(item)} disabled={refreshing === item.credentialIdHash} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait"><RefreshIcon className="size-4" />Refresh</button>
                          <Link href={`/verify/${item.networkKey}/${item.credentialIdHash}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Verify <ExternalLinkIcon className="size-4" /></Link>
                          <button onClick={() => downloadReceipt(item)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><DownloadIcon className="size-4" />Receipt</button>
                          <button onClick={() => { setShareTarget(item); setShareUrl(""); setCopied(false); }} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"><LinkIcon className="size-4" />Share</button>
                          <button onClick={() => removeCredential(item)} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label="Remove saved credential"><TrashIcon className="size-4" /></button>
                        </div>
                      </div>
                      {item.status === "replaced" && item.replacement && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">A replacement is registered: <span className="font-mono">{shortValue(item.replacement)}</span></p>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </section>

      {shareTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation">
          <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-blue-700">Wallet-signed presentation</p><h2 id="share-title" className="mt-1 text-xl font-semibold text-slate-950">Create controlled link</h2></div><button onClick={() => setShareTarget(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close share dialog"><XIcon className="size-4" /></button></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Anyone with the link can view the live registry result until it expires. Your wallet signs the presentation; no transaction or gas is required.</p>
            <label className="mt-4 block text-xs font-semibold text-slate-700">Link duration
              <select value={shareDays} onChange={(event) => setShareDays(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                <option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option>
              </select>
            </label>
            {!shareUrl ? (
              <button onClick={createShareLink} disabled={sharing} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400"><LinkIcon className="size-4" />{sharing ? "Waiting for wallet signature…" : "Sign and create link"}</button>
            ) : (
              <>
                <p className="mt-4 max-h-28 overflow-auto break-all rounded-lg bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-600">{shareUrl}</p>
                <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={copyShareLink} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><CopyIcon className="size-4" />{copied ? "Copied" : "Copy link"}</button><a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold !text-white hover:bg-blue-700">Open <ExternalLinkIcon className="size-4" /></a></div>
              </>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500">The signature identifies the presenting wallet but does not prove the signer is the student named on a private source document. Links cannot be revoked early in this MVP.</p>
          </section>
        </div>
      )}
    </main>
  );
}
