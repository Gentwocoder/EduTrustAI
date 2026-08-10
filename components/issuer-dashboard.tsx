"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BrowserProvider, Contract, id as hashText, isAddress, sha256 } from "ethers";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useAppKitState,
  useDisconnect,
  type Provider,
} from "@reown/appkit/react";
import { Brand } from "@/components/brand";
import { BulkIssuance } from "@/components/bulk-issuance";
import { CredentialQr } from "@/components/credential-qr";
import { useBotNetwork } from "@/components/network-provider";
import { NetworkSwitcher } from "@/components/network-switcher";
import {
  ensureBotChain,
  walletConnectionErrorMessage,
  walletNetworkErrorMessage,
  type WalletRequestProvider,
} from "@/lib/wallet-network";
import {
  ISSUER_ROLE,
  REGISTRY_ABI,
  REGISTRY_ADDRESS,
  registryExplorerUrl,
  type BotNetworkKey,
} from "@/lib/registry";
import { friendlyTransactionError } from "@/lib/transaction-errors";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BanIcon,
  CheckCircleIcon,
  CircleHelpIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HomeIcon,
  LogOutIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";

type Activity = {
  credentialId?: string;
  credentialIdHash: string;
  documentHash: string;
  transactionHash: string;
  confirmedAt: string;
  blockNumber?: number;
  revokedAt: number;
  status: CredentialStatus;
};

type CredentialStatus = "valid" | "revoked" | "unknown";

type ChainActivity = {
  credentialIdHash: string;
  documentHash: string;
  transactionHash: string;
  issuedAt: number;
  blockNumber: number;
  revokedAt: number;
  status: CredentialStatus;
};

type Notice = {
  tone: "success" | "error";
  title?: string;
  text: string;
};

type InstitutionProfile = {
  id: string;
  name: string;
  category: string;
  wallet: string;
  website?: string;
  country?: string;
  verified: true;
  verificationMethod: string;
};

type IssuerRecord = {
  account: string;
  changedBy: string;
  transactionHash: string;
  blockNumber: number;
  active: boolean;
  profile?: InstitutionProfile | null;
};

type RoleData = {
  account: {
    address: string;
    isAdmin: boolean;
    isIssuer: boolean;
    profile?: InstitutionProfile | null;
  };
  issuers: IssuerRecord[];
};

const inputClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
const labelClass = "text-xs font-semibold text-slate-700";
const activityStoragePrefix = "edutrust:issuance:v2:";

async function fetchRoleData(
  address: string,
  networkKey: BotNetworkKey,
): Promise<RoleData> {
  const response = await fetch(
    `/api/registry?network=${networkKey}&roles=true&account=${encodeURIComponent(address)}`,
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(data?.message ?? "Issuer access could not be loaded.");
  }

  return response.json() as Promise<RoleData>;
}

function shortValue(value: string, start = 8, end = 6) {
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function activityStorageKey(address: string, networkKey: BotNetworkKey) {
  return `${activityStoragePrefix}${networkKey}:${address.toLowerCase()}`;
}

function readStoredActivity(address: string, networkKey: BotNetworkKey): Activity[] {
  try {
    const value = window.localStorage.getItem(activityStorageKey(address, networkKey));
    return value ? JSON.parse(value) as Activity[] : [];
  } catch {
    return [];
  }
}

function storeActivity(address: string, networkKey: BotNetworkKey, activity: Activity[]) {
  try {
    window.localStorage.setItem(activityStorageKey(address, networkKey), JSON.stringify(activity));
  } catch {
    // The on-chain event remains the canonical fallback when storage is unavailable.
  }
}

function mergeActivity(local: Activity[], chain: ChainActivity[]) {
  const localByTransaction = new Map(local.map((item) => [item.transactionHash.toLowerCase(), item]));
  const merged = chain.map((item) => {
    const saved = localByTransaction.get(item.transactionHash.toLowerCase());
    return {
      credentialId: saved?.credentialId,
      credentialIdHash: item.credentialIdHash,
      documentHash: item.documentHash,
      transactionHash: item.transactionHash,
      confirmedAt: new Date(item.issuedAt * 1000).toLocaleString(),
      blockNumber: item.blockNumber,
      revokedAt: item.revokedAt,
      status: item.status,
    } satisfies Activity;
  });

  const chainTransactions = new Set(chain.map((item) => item.transactionHash.toLowerCase()));
  const localOnly = local
    .filter((item) => !chainTransactions.has(item.transactionHash.toLowerCase()))
    .map((item) => ({
      ...item,
      revokedAt: item.revokedAt ?? 0,
      status: item.status ?? "unknown" as CredentialStatus,
    }));
  return [...merged, ...localOnly];
}

export function IssuerDashboard() {
  const { network, networkKey } = useBotNetwork();
  const { open, close } = useAppKit();
  const { open: walletModalOpen, loading: walletModalLoading } = useAppKitState();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { walletProvider } = useAppKitProvider<Provider>("eip155");
  const { disconnect } = useDisconnect();
  const account = address ?? "";
  const [view, setView] = useState<"overview" | "issue" | "bulk" | "issuers">("overview");
  const [documentHash, setDocumentHash] = useState("");
  const [fileName, setFileName] = useState("");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Activity | null>(null);
  const [revocationReason, setRevocationReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [roleAccess, setRoleAccess] = useState({ isAdmin: false, isIssuer: false });
  const [issuers, setIssuers] = useState<IssuerRecord[]>([]);
  const [institutionProfile, setInstitutionProfile] = useState<InstitutionProfile | null>(null);
  const [activityRefresh, setActivityRefresh] = useState(0);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [managingIssuer, setManagingIssuer] = useState(false);
  const [issuerToRemove, setIssuerToRemove] = useState<IssuerRecord | null>(null);
  const preparedNetworkRef = useRef("");

  useEffect(() => {
    let active = true;
    async function loadWalletActivity() {
      // Defer state synchronization so account changes don't cascade within
      // the effect's initial render cycle.
      await Promise.resolve();
      if (!active) return;

      if (!account) {
        setActivity([]);
        setLoadingActivity(false);
        return;
      }

      const stored = readStoredActivity(account, networkKey);
      setActivity(stored);
      setLoadingActivity(true);

      try {
        const response = await fetch(`/api/registry?network=${networkKey}&issuer=${encodeURIComponent(account)}`);
        if (!response.ok) throw new Error("Activity could not be loaded");
        const data = await response.json() as { activity: ChainActivity[] };
        if (!active) return;
        const next = mergeActivity(stored, data.activity);
        setActivity(next);
        storeActivity(account, networkKey, next);
      } catch {
        // Keep wallet-scoped local history visible if the RPC cannot serve logs.
      } finally {
        if (active) setLoadingActivity(false);
      }
    }

    void loadWalletActivity();

    return () => {
      active = false;
    };
  }, [account, activityRefresh, networkKey]);

  useEffect(() => {
    let active = true;

    async function loadRoleAccess() {
      await Promise.resolve();
      if (!active) return;

      if (!account) {
        setRoleAccess({ isAdmin: false, isIssuer: false });
        setInstitutionProfile(null);
        setIssuers([]);
        setLoadingRoles(false);
        setView((current) => current === "issuers" ? "overview" : current);
        return;
      }

      setLoadingRoles(true);
      try {
        const data = await fetchRoleData(account, networkKey);
        if (!active) return;
        setRoleAccess({
          isAdmin: data.account.isAdmin,
          isIssuer: data.account.isIssuer,
        });
        setInstitutionProfile(data.account.profile ?? null);
        setIssuers(data.issuers);
        if (!data.account.isAdmin) {
          setView((current) => current === "issuers" ? "overview" : current);
        }
      } catch {
        if (!active) return;
        setRoleAccess({ isAdmin: false, isIssuer: false });
        setInstitutionProfile(null);
        setIssuers([]);
      } finally {
        if (active) setLoadingRoles(false);
      }
    }

    void loadRoleAccess();

    return () => {
      active = false;
    };
  }, [account, networkKey]);

  useEffect(() => {
    if (isConnected && walletModalOpen) {
      void close();
    }
  }, [close, isConnected, walletModalOpen]);

  useEffect(() => {
    if (!walletProvider || !isConnected || !account) {
      preparedNetworkRef.current = "";
      return;
    }

    // Never send add/switch requests while AppKit is still completing the
    // account connection. OKX and Bitget reject overlapping wallet requests.
    if (walletModalOpen || walletModalLoading) return;

    const preparationKey = `${account.toLowerCase()}:${network.key}`;
    if (preparedNetworkRef.current === preparationKey) return;
    preparedNetworkRef.current = preparationKey;
    let active = true;

    const preparationTimer = window.setTimeout(() => {
      void ensureBotChain(
        walletProvider as WalletRequestProvider,
        network,
      )
        .then(({ added, switched }) => {
          if (active && (added || switched)) {
            setNotice({
              tone: "success",
              text: `${network.name} is ready in your wallet.`,
            });
          }
        })
        .catch((error) => {
          if (!active) return;
          if (preparedNetworkRef.current === preparationKey) {
            preparedNetworkRef.current = "";
          }
          setNotice({
            tone: "error",
            text: walletNetworkErrorMessage(error, network),
          });
        });
    }, 500);

    return () => {
      active = false;
      window.clearTimeout(preparationTimer);
    };
  }, [
    account,
    isConnected,
    network,
    walletModalLoading,
    walletModalOpen,
    walletProvider,
  ]);

  async function getSigner() {
    if (!walletProvider || !isConnected || !account) {
      await open({ view: "Connect", namespace: "eip155" });
      throw new Error("Connect an EVM wallet, then submit the transaction again.");
    }

    await ensureBotChain(walletProvider as WalletRequestProvider, network);
    const provider = new BrowserProvider(walletProvider);
    const signer = await provider.getSigner();
    return signer;
  }

  async function connectWallet(manageExisting = false) {
    setConnecting(true);
    setNotice(null);
    try {
      if (manageExisting) {
        await open({ view: "Account" });
      } else {
        await open({ view: "Connect", namespace: "eip155" });
      }
    } catch (error) {
      setNotice({ tone: "error", text: walletConnectionErrorMessage(error) });
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectWallet() {
    try {
      await disconnect({ namespace: "eip155" });
      preparedNetworkRef.current = "";
      setActivity([]);
      setRevokeTarget(null);
      setRevocationReason("");
      setView("overview");
      setNotice({ tone: "success", text: "Wallet disconnected from EduTrust." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The wallet could not be disconnected." });
    }
  }

  async function refreshRoleData() {
    if (!account) return;
    const data = await fetchRoleData(account, networkKey);
    setRoleAccess({
      isAdmin: data.account.isAdmin,
      isIssuer: data.account.isIssuer,
    });
    setInstitutionProfile(data.account.profile ?? null);
    setIssuers(data.issuers);
  }

  async function approveIssuer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const issuerAddress = String(data.get("issuerAddress") ?? "").trim();

    if (!isAddress(issuerAddress)) {
      setNotice({
        tone: "error",
        title: "Invalid wallet address",
        text: "Enter a complete EVM wallet address beginning with 0x.",
      });
      return;
    }

    if (issuers.some((item) => item.account.toLowerCase() === issuerAddress.toLowerCase())) {
      setNotice({
        tone: "error",
        title: "Wallet already authorised",
        text: "This wallet already has permission to issue credentials on the selected network.",
      });
      return;
    }

    setManagingIssuer(true);
    setNotice(null);
    try {
      const signer = await getSigner();
      const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const transaction = await registry.grantRole(ISSUER_ROLE, issuerAddress);
      await transaction.wait();
      await refreshRoleData();
      form.reset();
      setNotice({
        tone: "success",
        title: "Issuer wallet approved",
        text: `${shortValue(issuerAddress)} can now issue credentials on ${network.name}.`,
      });
    } catch (error) {
      console.error("Issuer approval failed", error);
      const friendly = friendlyTransactionError(error, "grantIssuer", network.name);
      setNotice({
        tone: "error",
        title: friendly.title,
        text: friendly.message,
      });
    } finally {
      setManagingIssuer(false);
    }
  }

  async function removeIssuer() {
    if (!issuerToRemove) return;

    setManagingIssuer(true);
    setNotice(null);
    try {
      const signer = await getSigner();
      const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const transaction = await registry.revokeRole(ISSUER_ROLE, issuerToRemove.account);
      await transaction.wait();
      const removedAddress = issuerToRemove.account;
      setIssuerToRemove(null);
      await refreshRoleData();
      setNotice({
        tone: "success",
        title: "Issuer access removed",
        text: `${shortValue(removedAddress)} can no longer issue new credentials on ${network.name}.`,
      });
    } catch (error) {
      console.error("Issuer removal failed", error);
      const friendly = friendlyTransactionError(error, "revokeIssuer", network.name);
      setNotice({
        tone: "error",
        title: friendly.title,
        text: friendly.message,
      });
    } finally {
      setManagingIssuer(false);
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
      const issuerAddress = await signer.getAddress();
      const issuedActivity: Activity = {
        credentialId,
        credentialIdHash: hashText(credentialId),
        documentHash,
        transactionHash,
        confirmedAt: new Date().toLocaleString(),
        blockNumber: receipt?.blockNumber,
        revokedAt: 0,
        status: "valid",
      };
      setActivity((current) => {
        const next = [issuedActivity, ...current.filter((item) => item.transactionHash.toLowerCase() !== transactionHash.toLowerCase())];
        storeActivity(issuerAddress, networkKey, next);
        return next;
      });
      form.reset();
      setDocumentHash("");
      setFileName("");
      setView("overview");
      setNotice({ tone: "success", text: `${credentialId} was confirmed on ${network.name}.` });
    } catch (error) {
      console.error("Credential issuance failed", error);
      const friendly = friendlyTransactionError(error, "issue", network.name);
      setNotice({
        tone: "error",
        title: friendly.title,
        text: friendly.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!revokeTarget) return;

    const reason = revocationReason.trim();
    if (!reason) {
      setNotice({ tone: "error", text: "Enter an internal reason before revoking the credential." });
      return;
    }

    setRevoking(true);
    setNotice(null);
    try {
      const signer = await getSigner();
      const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const transaction = await registry.revokeCredential(revokeTarget.credentialIdHash, hashText(reason));
      const receipt = await transaction.wait();
      const issuerAddress = await signer.getAddress();
      const revokedAt = Math.floor(Date.now() / 1000);

      setActivity((current) => {
        const next = current.map((item) => item.credentialIdHash.toLowerCase() === revokeTarget.credentialIdHash.toLowerCase()
          ? { ...item, status: "revoked" as const, revokedAt }
          : item);
        storeActivity(issuerAddress, networkKey, next);
        return next;
      });
      setRevokeTarget(null);
      setRevocationReason("");
      setNotice({
        tone: "success",
        text: `Credential revoked on ${network.name}. Transaction ${shortValue(receipt?.hash ?? transaction.hash)} confirmed.`,
      });
    } catch (error) {
      console.error("Credential revocation failed", error);
      const friendly = friendlyTransactionError(error, "revoke", network.name);
      setNotice({
        tone: "error",
        title: friendly.title,
        text: friendly.message,
      });
    } finally {
      setRevoking(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 lg:px-5">
          <Link href="/" aria-label="EduTrust AI home"><Brand /></Link>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Issuer</span>
        </div>

        <div className="hidden h-[calc(100vh-4rem)] flex-col p-3 lg:flex">
          <div className="mb-4 rounded-lg border border-slate-200 p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wallet access</span>
            <strong className="mt-2 block truncate text-xs text-slate-900">{institutionProfile?.name ?? (account ? "Authorised issuer" : "Not connected")}</strong>
            {account && <span className="mt-1 block truncate font-mono text-[11px] text-slate-500">{shortValue(account)}</span>}
            <span className={`mt-1 block text-xs ${account ? "text-emerald-700" : "text-slate-500"}`}>{account ? "Connected to issuer workspace" : "Connect an authorised wallet"}</span>
          </div>

          <nav className="space-y-1" aria-label="Institution portal">
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${view === "overview" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`} onClick={() => setView("overview")}><HomeIcon className="size-5 shrink-0" />Overview</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${view === "issue" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`} onClick={() => setView("issue")}><PlusIcon className="size-5 shrink-0" />Issue credential</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${view === "bulk" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`} onClick={() => setView("bulk")}><FileTextIcon className="size-5 shrink-0" />Bulk issuance</button>
            {roleAccess.isAdmin && <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${view === "issuers" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`} onClick={() => setView("issuers")}><UsersIcon className="size-5 shrink-0" />Issuer management</button>}
            <a className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" href={registryExplorerUrl(network)} target="_blank" rel="noreferrer"><ExternalLinkIcon className="size-5 shrink-0" />BOT explorer</a>
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deployment network</span><span className="size-2 rounded-full bg-emerald-500" /></div>
              <strong className="mt-2 block text-xs font-semibold text-slate-800">{network.name}</strong>
              <span className="mt-1 block font-mono text-xs text-slate-500">Chain ID {network.chainId}</span>
            </div>
            <Link className="inline-flex items-center gap-2 px-2 text-sm font-medium text-slate-500 hover:text-slate-900" href="/"><ArrowLeftIcon className="size-4" /> Back to public site</Link>
          </div>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Institution portal</p><h1 className="mt-0.5 text-sm font-semibold text-slate-900">{view === "overview" ? "Credential registry" : view === "issue" ? "Issue a credential" : view === "bulk" ? "Bulk issuance" : "Issuer management"}</h1></div>
          <div className="flex items-center gap-2">
            <NetworkSwitcher compact className="hidden sm:inline-flex" />
            {account ? (
              <>
              <span className="hidden rounded-md bg-slate-100 px-2.5 py-2 font-mono text-xs font-semibold text-slate-700 sm:inline-flex">{shortValue(account, 6, 4)}</span>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:text-slate-400" onClick={() => connectWallet(true)} disabled={connecting}><WalletIcon className="size-4" />{connecting ? "Opening wallet…" : "Manage wallet"}</button>
              <button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200" onClick={disconnectWallet}><LogOutIcon className="size-4" />Disconnect</button>
              </>
            ) : (
              <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400" onClick={() => connectWallet()} disabled={connecting}>
                <WalletIcon className="size-4" />{connecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </div>
        </header>

        <div className="border-b border-slate-200 bg-white px-4 py-2 sm:hidden">
          <NetworkSwitcher className="w-full justify-center" />
        </div>

        {notice && (
          <div className={`mx-4 mt-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm sm:mx-6 lg:mx-8 ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} role={notice.tone === "error" ? "alert" : "status"}>
            <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white ${notice.tone === "success" ? "bg-emerald-600" : "bg-red-600"}`}>{notice.tone === "success" ? <CheckCircleIcon className="size-4" /> : <AlertCircleIcon className="size-4" />}</span>
            <div className="min-w-0 flex-1">
              {notice.title && <strong className="block font-semibold">{notice.title}</strong>}
              <span className={`block break-words leading-5 ${notice.title ? "mt-0.5 font-normal" : "font-medium"}`}>{notice.text}</span>
            </div>
            <button className="rounded-md p-1.5 hover:bg-black/5" onClick={() => setNotice(null)} aria-label="Dismiss notification"><XIcon className="size-4" /></button>
          </div>
        )}

        {view === "overview" ? (
          <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-xs font-semibold text-blue-700">BOT Chain registry</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Credential activity</h2><p className="mt-1 text-sm text-slate-600">Connect an authorised wallet to issue credentials and manage their current on-chain status.</p></div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200" onClick={() => setView("bulk")}><FileTextIcon className="mr-2 size-4" />Bulk issue</button>
                {roleAccess.isAdmin && <button className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200" onClick={() => setView("issuers")}><UsersIcon className="mr-2 size-4" />Manage issuers</button>}
                <button className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" onClick={() => setView("issue")}><PlusIcon className="mr-2 size-4" /> <span>Issue credential</span></button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-medium text-slate-500">Institution profile</span><strong className="mt-2 block text-sm text-slate-950">{institutionProfile?.name ?? (account ? "Profile pending" : "Not connected")}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{institutionProfile?.verified ? `Verified · ${institutionProfile.category}` : account ? "Authorised wallet without a published profile" : "Connect a wallet to resolve its profile"}</span></article>
              <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-medium text-slate-500">Registry contract</span><a href={registryExplorerUrl(network)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-mono text-sm font-semibold text-blue-700 hover:text-blue-800"><span>{shortValue(REGISTRY_ADDRESS)}</span><ExternalLinkIcon className="size-4" /></a><span className="mt-1 block text-xs leading-5 text-slate-500">{network.name}</span></article>
              <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-medium text-slate-500">Issued by wallet</span><strong className="mt-1 block text-2xl font-semibold tracking-tight text-slate-950">{account ? activity.length : "—"}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{loadingActivity ? "Loading confirmed activity…" : account ? "Restored when this wallet reconnects" : "Connect a wallet to load activity"}</span></article>
            </div>

            <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-5"><h3 className="text-base font-semibold text-slate-900">Wallet activity</h3><p className="mt-1 text-sm text-slate-500">Issued credentials and their canonical BOT Chain status</p></div>
              {loadingActivity && activity.length === 0 ? (
                <div className="px-5 py-14 text-center"><span className="text-sm font-semibold text-slate-700">Loading wallet activity…</span><p className="mt-1 text-xs text-slate-500">Reading confirmed issuance events from {network.name}.</p></div>
              ) : activity.length === 0 ? (
                <div className="px-5 py-14 text-center"><span className="mx-auto grid size-11 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileTextIcon className="size-5" /></span><h4 className="mt-3 text-base font-semibold text-slate-900">{account ? "No issuance activity yet" : "Connect a wallet to view activity"}</h4><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{account ? "Records will appear here after this wallet confirms an issuance transaction." : "EduTrust restores the issuance history associated with each connected wallet."}</p>{account && <button onClick={() => setView("issue")} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800">Issue the first credential</button>}</div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[1000px] border-collapse text-left"><thead><tr className="bg-slate-50 text-sm font-semibold uppercase tracking-wider text-slate-600"><th className="px-5 py-3">Credential</th><th className="px-5 py-3">Document fingerprint</th><th className="px-5 py-3">Confirmed</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{activity.map((item) => <tr className="text-sm text-slate-700" key={item.transactionHash}><td className="px-5 py-4 font-mono font-semibold text-slate-900" title={item.credentialId ?? item.credentialIdHash}>{item.credentialId ?? shortValue(item.credentialIdHash)}</td><td className="px-5 py-4 font-mono">{shortValue(item.documentHash)}</td><td className="px-5 py-4 text-slate-500">{item.confirmedAt}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold capitalize ring-1 ring-inset ${item.status === "valid" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : item.status === "revoked" ? "bg-red-50 text-red-700 ring-red-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{item.status === "valid" ? <CheckCircleIcon className="size-4" /> : item.status === "revoked" ? <BanIcon className="size-4" /> : <CircleHelpIcon className="size-4" />}{item.status}</span>{item.status === "revoked" && item.revokedAt > 0 && <span className="mt-1 block text-xs text-slate-400">{new Date(item.revokedAt * 1000).toLocaleString()}</span>}</td><td className="px-5 py-4 text-right"><div className="flex items-center justify-end gap-3"><CredentialQr credentialIdHash={item.credentialIdHash} networkKey={networkKey} /><a className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200" href={`${network.explorerUrl}/tx/${item.transactionHash}`} target="_blank" rel="noreferrer">View <ExternalLinkIcon className="size-4" /></a>{item.status === "valid" && <button className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200" onClick={() => { setRevokeTarget(item); setRevocationReason(""); setNotice(null); }}><BanIcon className="size-4" />Revoke</button>}</div></td></tr>)}</tbody></table></div>
              )}
            </section>
          </div>
        ) : view === "issue" ? (
          <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
            <button className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={() => setView("overview")}><ArrowLeftIcon className="size-4" /> Back to registry</button>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
              <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" onSubmit={issueCredential}>
                <div className="border-b border-slate-200 pb-5"><p className="text-xs font-semibold text-blue-700">New registry entry</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Issue credential</h2><p className="mt-1 text-sm text-slate-600">The wallet signs a transaction containing only one-way fingerprints.</p></div>
                <div className="mt-6 space-y-5">
                  <label className={labelClass}>Credential ID<input className={`${inputClass} font-mono`} name="credentialId" required placeholder="Enter the institution-issued identifier" autoComplete="off" /></label>
                  <label className={labelClass}>Source document<span className="mt-1 block text-xs font-normal leading-5 text-slate-500">The file stays on this device. EduTrust calculates its SHA-256 fingerprint locally.</span><input className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700`} name="document" type="file" accept="application/pdf,image/*" required onChange={(event) => selectDocument(event.target.files?.[0])} /></label>
                  <label className={labelClass}>Document fingerprint<input className={`${inputClass} font-mono text-slate-500`} readOnly value={documentHash} placeholder="Calculated after a document is selected" /></label>
                </div>
                <div className="mt-5 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800"><ShieldCheckIcon className="mt-0.5 size-5 shrink-0" /><p><strong>Privacy-preserving issuance.</strong> The selected document and its contents are never uploaded by this interface.</p></div>
                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end"><button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setView("overview")}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-wait disabled:bg-blue-400" disabled={submitting}>{submitting ? "Waiting for confirmation…" : account ? "Issue credential" : "Connect wallet and issue"}</button></div>
              </form>

              <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white"><Image src="/favicon.svg" alt="" width={24} height={24} /></span><span className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${network.key === "mainnet" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>{network.shortName}</span></div>
                <h3 className="mt-5 text-sm font-semibold text-slate-900">Transaction preview</h3><p className="mt-1 text-xs leading-5 text-slate-500">Review the public destination before approving the wallet request.</p>
                <dl className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-xs text-slate-500">Network</dt><dd className="text-right text-xs font-semibold text-slate-800">{network.name}</dd></div>
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-xs text-slate-500">Chain ID</dt><dd className="font-mono text-xs font-semibold text-slate-800">{network.chainId}</dd></div>
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-xs text-slate-500">Issuer</dt><dd className="max-w-[160px] text-right font-mono text-xs font-semibold text-slate-800">{account ? shortValue(account) : "Not connected"}</dd></div>
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-xs text-slate-500">Contract</dt><dd className="max-w-[160px] text-right font-mono text-xs font-semibold text-slate-800">{shortValue(REGISTRY_ADDRESS)}</dd></div>
                  <div className="flex items-start justify-between gap-4 py-3"><dt className="text-xs text-slate-500">Document</dt><dd className="max-w-[160px] truncate text-right font-mono text-xs font-semibold text-slate-800" title={documentHash}>{documentHash ? shortValue(documentHash) : fileName || "Not selected"}</dd></div>
                </dl>
                <div className="mt-4 rounded-lg bg-slate-50 p-3"><strong className="text-xs font-semibold text-slate-800">Never written on-chain</strong><p className="mt-1 text-xs leading-5 text-slate-500">Student name · Grade · Certificate file · Contact details</p></div>
              </aside>
            </div>
          </div>
        ) : view === "bulk" ? (
          <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
            <button className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={() => setView("overview")}><ArrowLeftIcon className="size-4" /> Back to registry</button>
            <BulkIssuance onComplete={() => setActivityRefresh((current) => current + 1)} />
          </div>
        ) : (
          <div className="mx-auto max-w-[1200px] p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold text-blue-700">Registry administration</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Issuer management</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Approve trusted institution wallets and remove access when responsibilities change. Every update is recorded on {network.name}.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><ShieldCheckIcon className="size-4" />Administrator verified</span>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(300px,.72fr)_minmax(0,1.28fr)]">
              <div className="space-y-5">
                <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={approveIssuer}>
                  <span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-blue-700"><UserPlusIcon className="size-5" /></span>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">Approve issuer wallet</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">The approved wallet will be able to issue credentials and revoke credentials it originally issued.</p>
                  <label className={`${labelClass} mt-5 block`}>Wallet address<input className={`${inputClass} font-mono`} name="issuerAddress" required placeholder="0x…" autoComplete="off" spellCheck={false} /></label>
                  <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-wait disabled:bg-blue-400" disabled={managingIssuer || loadingRoles}><UserPlusIcon className="size-4" />{managingIssuer ? "Waiting for confirmation…" : "Approve issuer"}</button>
                </form>

                <aside className="rounded-xl border border-slate-200 bg-slate-100/70 p-4">
                  <div className="flex gap-3"><ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-slate-600" /><div><h3 className="text-sm font-semibold text-slate-900">Permissioned by design</h3><p className="mt-1 text-sm leading-6 text-slate-600">Only the registry administrator can change issuer access. Removing access prevents new issuance but does not alter existing credentials.</p></div></div>
                </aside>
              </div>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
                  <div><h3 className="text-base font-semibold text-slate-900">Authorised issuers</h3><p className="mt-1 text-sm text-slate-500">{network.name}</p></div>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-700">{loadingRoles ? "…" : issuers.length}</span>
                </div>
                {loadingRoles ? (
                  <div className="px-5 py-14 text-center text-sm font-medium text-slate-600">Loading issuer permissions…</div>
                ) : issuers.length === 0 ? (
                  <div className="px-5 py-14 text-center"><span className="mx-auto grid size-11 place-items-center rounded-lg bg-slate-100 text-slate-500"><UsersIcon className="size-5" /></span><h4 className="mt-3 text-base font-semibold text-slate-900">No issuer history found</h4><p className="mt-1 text-sm text-slate-500">Approve the first issuer wallet for this network.</p></div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {issuers.map((issuer) => {
                      const isCurrentWallet = issuer.account.toLowerCase() === account.toLowerCase();
                      return (
                        <article className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" key={issuer.account}>
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><WalletIcon className="size-5" /></span>
                            <div className="min-w-0">{issuer.profile && <span className="mb-1 block text-sm font-semibold text-slate-900">{issuer.profile.name} <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">Verified</span></span>}<div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-sm text-slate-900" title={issuer.account}>{shortValue(issuer.account, 8, 6)}</strong>{isCurrentWallet && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">Current wallet</span>}</div><a className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-700" href={`${network.explorerUrl}/tx/${issuer.transactionHash}`} target="_blank" rel="noreferrer">Approval transaction <ExternalLinkIcon className="size-3.5" /></a></div>
                          </div>
                          {isCurrentWallet ? (
                            <span className="text-xs font-medium text-slate-500">Protected from self-removal</span>
                          ) : (
                            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-wait disabled:text-red-300" type="button" onClick={() => { setIssuerToRemove(issuer); setNotice(null); }} disabled={managingIssuer}><BanIcon className="size-4" />Remove access</button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {issuerToRemove && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="presentation">
            <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="remove-issuer-title">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-red-700">Access control change</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950" id="remove-issuer-title">Remove issuer access</h2></div><button className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed" type="button" onClick={() => setIssuerToRemove(null)} disabled={managingIssuer} aria-label="Close issuer removal dialog"><XIcon className="size-5" /></button></div>
              <p className="mt-3 text-sm leading-6 text-slate-600">This wallet will no longer be able to issue new credentials or perform issuer-only actions on {network.name}.</p>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm font-semibold text-slate-800">{issuerToRemove.account}</div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Previously issued credentials remain on-chain and keep their current status.</p>
              <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end"><button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed" type="button" onClick={() => setIssuerToRemove(null)} disabled={managingIssuer}>Cancel</button><button className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:bg-red-400" type="button" onClick={removeIssuer} disabled={managingIssuer}>{managingIssuer ? "Waiting for confirmation…" : "Remove access"}</button></div>
            </section>
          </div>
        )}

        {revokeTarget && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="presentation">
            <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="revoke-title">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-semibold text-red-700">Permanent status change</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950" id="revoke-title">Revoke credential</h2></div>
                <button className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed" type="button" onClick={() => { setRevokeTarget(null); setRevocationReason(""); }} disabled={revoking} aria-label="Close revocation dialog"><XIcon className="size-5" /></button>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">This marks the credential as revoked on {network.name}. The blockchain transaction cannot be reversed.</p>
              <dl className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-4"><dt className="text-xs text-slate-500">Credential</dt><dd className="max-w-[240px] truncate text-right font-mono text-xs font-semibold text-slate-800" title={revokeTarget.credentialId ?? revokeTarget.credentialIdHash}>{revokeTarget.credentialId ?? shortValue(revokeTarget.credentialIdHash)}</dd></div>
                <div className="mt-2 flex items-start justify-between gap-4"><dt className="text-xs text-slate-500">Issuer wallet</dt><dd className="font-mono text-xs font-semibold text-slate-800">{shortValue(account)}</dd></div>
              </dl>
              <form className="mt-5" onSubmit={revokeCredential}>
                <label className={labelClass}>Revocation reason<textarea className={`${inputClass} min-h-24 resize-y`} required value={revocationReason} onChange={(event) => setRevocationReason(event.target.value)} placeholder="For example: issued in error or credential withdrawn" /></label>
                <p className="mt-2 text-xs leading-5 text-slate-500">The reason stays in this browser. Only its one-way fingerprint is included in the public revocation event.</p>
                {notice?.tone === "error" && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">{notice.text}</div>}
                <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                  <button className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" type="button" onClick={() => { setRevokeTarget(null); setRevocationReason(""); }} disabled={revoking}>Cancel</button>
                  <button className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2 disabled:cursor-wait disabled:bg-red-400" disabled={revoking}>{revoking ? "Waiting for confirmation…" : "Revoke credential"}</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
