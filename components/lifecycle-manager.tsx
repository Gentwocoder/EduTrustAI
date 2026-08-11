"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { BrowserProvider, Contract, id as hashText, isAddress, sha256 } from "ethers";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
  type Provider,
} from "@reown/appkit/react";
import { Brand } from "@/components/brand";
import { NetworkSwitcher } from "@/components/network-switcher";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  KeyIcon,
  RefreshIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "@/components/icons";
import { useBotNetwork } from "@/components/network-provider";
import { ensureBotChain, type WalletRequestProvider } from "@/lib/wallet-network";
import {
  REGISTRY_ABI,
  registryAddressForNetwork,
  registryExplorerUrl,
} from "@/lib/registry";
import { friendlyTransactionError } from "@/lib/transaction-errors";

type Notice = { tone: "success" | "error"; title: string; text: string };

function shortValue(value: string, start = 8, end = 6) {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

export function LifecycleManager() {
  const { network, networkKey } = useBotNetwork();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { walletProvider } = useAppKitProvider<Provider>("eip155");
  const { disconnect } = useDisconnect();
  const account = address ?? "";
  const [registryVersion, setRegistryVersion] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  const [operation, setOperation] = useState<"renew" | "correct">("renew");
  const [documentHash, setDocumentHash] = useState("");
  const [fileName, setFileName] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;
    setRegistryVersion(null);
    fetch(`/api/registry?network=${networkKey}`)
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setAvailable(Boolean(data.available));
        setRegistryVersion(Number(data.registryVersion ?? 1));
      })
      .catch(() => {
        if (!active) return;
        setAvailable(false);
        setRegistryVersion(1);
      });
    return () => { active = false; };
  }, [networkKey]);

  async function getSigner() {
    if (!walletProvider || !isConnected || !account) {
      await open({ view: "Connect", namespace: "eip155" });
      throw new Error("Connect the authorised institution wallet and try again.");
    }
    await ensureBotChain(walletProvider as WalletRequestProvider, network);
    return new BrowserProvider(walletProvider).getSigner();
  }

  async function selectDocument(file?: File) {
    setDocumentHash("");
    setFileName("");
    if (!file) return;
    setDocumentHash(sha256(new Uint8Array(await file.arrayBuffer())));
    setFileName(file.name);
  }

  async function replaceCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((registryVersion ?? 1) < 2) {
      setNotice({
        tone: "error",
        title: "Registry V2 is not active",
        text: "Deploy EduTrustRegistryV2 and configure its network address before using renewal or correction.",
      });
      return;
    }
    if (!documentHash) {
      setNotice({ tone: "error", title: "Document required", text: "Select the replacement source document first." });
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const currentId = String(data.get("currentCredentialId") ?? "").trim();
    const replacementId = String(data.get("replacementCredentialId") ?? "").trim();
    const expiryValue = String(data.get("expiresAt") ?? "").trim();
    const expiresAt = expiryValue ? Math.floor(new Date(`${expiryValue}T23:59:59`).getTime() / 1000) : 0;
    if (expiresAt !== 0 && expiresAt <= Math.floor(Date.now() / 1000)) {
      setNotice({ tone: "error", title: "Invalid expiry", text: "Choose a future expiry date or leave it blank." });
      return;
    }

    setWorking(true);
    setNotice(null);
    try {
      const signer = await getSigner();
      const registry = new Contract(
        registryAddressForNetwork(networkKey),
        REGISTRY_ABI,
        signer,
      );
      const method = operation === "renew" ? "renewCredential" : "correctCredential";
      const transaction = await registry[method](
        hashText(currentId),
        hashText(replacementId),
        documentHash,
        expiresAt,
      );
      await transaction.wait();
      form.reset();
      setDocumentHash("");
      setFileName("");
      setNotice({
        tone: "success",
        title: operation === "renew" ? "Credential renewed" : "Correction registered",
        text: `The original now points to its replacement on ${network.name}. Transaction ${shortValue(transaction.hash)} confirmed.`,
      });
    } catch (error) {
      const friendly = friendlyTransactionError(error, operation, network.name);
      setNotice({ tone: "error", title: friendly.title, text: friendly.message });
    } finally {
      setWorking(false);
    }
  }

  async function proposeAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const newAdmin = String(new FormData(form).get("newAdmin") ?? "").trim();
    if (!isAddress(newAdmin)) {
      setNotice({ tone: "error", title: "Invalid administrator wallet", text: "Enter a complete EVM wallet address." });
      return;
    }
    if ((registryVersion ?? 1) < 2) {
      setNotice({ tone: "error", title: "Registry V2 is not active", text: "Admin recovery is available after the V2 registry is deployed." });
      return;
    }

    setWorking(true);
    setNotice(null);
    try {
      const signer = await getSigner();
      const registry = new Contract(registryAddressForNetwork(networkKey), REGISTRY_ABI, signer);
      const transaction = await registry.proposeAdminRotation(newAdmin);
      await transaction.wait();
      form.reset();
      setNotice({ tone: "success", title: "Rotation proposed", text: `${shortValue(newAdmin)} must connect and accept the administrator role.` });
    } catch (error) {
      const friendly = friendlyTransactionError(error, "adminRotation", network.name);
      setNotice({ tone: "error", title: friendly.title, text: friendly.message });
    } finally {
      setWorking(false);
    }
  }

  async function acceptAdmin() {
    if ((registryVersion ?? 1) < 2) return;
    setWorking(true);
    setNotice(null);
    try {
      const signer = await getSigner();
      const registry = new Contract(registryAddressForNetwork(networkKey), REGISTRY_ABI, signer);
      const transaction = await registry.acceptAdminRotation();
      await transaction.wait();
      setNotice({ tone: "success", title: "Administrator rotated", text: "This wallet is now the primary registry administrator. The previous administrator was removed." });
    } catch (error) {
      const friendly = friendlyTransactionError(error, "adminRotation", network.name);
      setNotice({ tone: "error", title: friendly.title, text: friendly.message });
    } finally {
      setWorking(false);
    }
  }

  const v2Active = registryVersion !== null && registryVersion >= 2;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="EduTrust AI home"><Brand /></Link>
          <div className="flex items-center gap-2">
            <NetworkSwitcher compact className="hidden sm:inline-flex" />
            {account ? (
              <><span className="hidden rounded-md bg-slate-100 px-2.5 py-2 font-mono text-xs font-semibold text-slate-700 md:inline-flex">{shortValue(account, 6, 4)}</span><button onClick={() => disconnect({ namespace: "eip155" })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Disconnect</button></>
            ) : (
              <button onClick={() => open({ view: "Connect", namespace: "eip155" })} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"><WalletIcon className="size-4" />Connect wallet</button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeftIcon className="size-4" />Back to institution portal</Link>
        <div className="mt-5 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Registry lifecycle</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Renewal, correction and key recovery</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Replace credentials without implying misconduct, and rotate registry administration through a separately protected recovery wallet.</p></div>
          <a href={registryExplorerUrl(network)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">View registry <ExternalLinkIcon className="size-4" /></a>
        </div>

        <div className={`mt-5 flex items-start gap-3 rounded-lg border p-4 ${v2Active ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          {v2Active ? <CheckCircleIcon className="mt-0.5 size-5 text-emerald-700" /> : <AlertCircleIcon className="mt-0.5 size-5 text-amber-700" />}
          <div><strong className="text-sm text-slate-950">{registryVersion === null ? "Checking registry version…" : v2Active ? "Registry V2 active" : "Live registry is V1"}</strong><p className="mt-1 text-xs leading-5 text-slate-600">{v2Active ? `Lifecycle and recovery transactions are available on ${network.name}.` : "Existing credentials remain fully verifiable. Lifecycle writes are disabled until the separately deployed V2 address is configured."}</p></div>
        </div>

        {notice && <div className={`mt-5 flex items-start gap-3 rounded-lg border p-4 ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.tone === "success" ? <CheckCircleIcon className="mt-0.5 size-5 shrink-0" /> : <AlertCircleIcon className="mt-0.5 size-5 shrink-0" />}<div><strong className="text-sm">{notice.title}</strong><p className="mt-1 text-sm leading-6">{notice.text}</p></div></div>}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <form onSubmit={replaceCredential} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><RefreshIcon className="size-5" /></span>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">Replace a credential</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">The old record remains auditable and points to the new credential as a renewal or correction.</p>
            <label className="mt-5 block text-xs font-semibold text-slate-700">Lifecycle action<select value={operation} onChange={(event) => setOperation(event.target.value as "renew" | "correct")} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="renew">Renew credential</option><option value="correct">Correct credential</option></select></label>
            <label className="mt-4 block text-xs font-semibold text-slate-700">Current credential ID<input name="currentCredentialId" required autoComplete="off" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm" /></label>
            <label className="mt-4 block text-xs font-semibold text-slate-700">Replacement credential ID<input name="replacementCredentialId" required autoComplete="off" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm" /></label>
            <label className="mt-4 block text-xs font-semibold text-slate-700">Replacement document<input type="file" accept="application/pdf,image/*" required onChange={(event) => selectDocument(event.target.files?.[0])} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold" /></label>
            <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-500">{documentHash || (fileName ? "Calculating fingerprint…" : "The replacement file remains on this device.")}</p>
            <label className="mt-4 block text-xs font-semibold text-slate-700">New expiry <span className="font-normal text-slate-400">(optional)</span><input type="date" name="expiresAt" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>
            <button disabled={working || !available || !v2Active} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"><RefreshIcon className="size-4" />{working ? "Waiting for confirmation…" : operation === "renew" ? "Renew credential" : "Register correction"}</button>
          </form>

          <div className="space-y-6">
            <form onSubmit={proposeAdmin} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-700"><KeyIcon className="size-5" /></span>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">Propose administrator rotation</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">The current administrator or recovery wallet proposes a replacement. The new wallet must accept before the previous key is removed.</p>
              <label className="mt-5 block text-xs font-semibold text-slate-700">New administrator wallet<input name="newAdmin" required placeholder="0x…" autoComplete="off" spellCheck={false} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm" /></label>
              <button disabled={working || !v2Active} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"><KeyIcon className="size-4" />Propose rotation</button>
            </form>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><ShieldCheckIcon className="size-5" /></span>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">Accept administrator role</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Connect the exact pending administrator wallet, then accept. This removes both administrator and issuer access from the previous primary wallet.</p>
              <button onClick={acceptAdmin} disabled={working || !v2Active || !account} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"><ShieldCheckIcon className="size-4" />Accept administrator role</button>
            </section>

            <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Multisig protection:</strong> use a Safe or another reviewed EVM multisig as the V2 recovery address. EduTrust delegates approval policy to that multisig instead of storing private keys or building an unaudited signer scheme.</aside>
          </div>
        </div>
      </section>
    </main>
  );
}
