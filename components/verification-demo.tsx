"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { isHexString } from "ethers";
import { useBotNetwork } from "@/components/network-provider";
import { registryAddressForNetwork, registryExplorerUrl, type BotNetworkKey } from "@/lib/registry";
import { downloadVerificationReceipt } from "@/lib/verification-receipt";
import { AlertCircleIcon, CheckCircleIcon, CircleHelpIcon, DownloadIcon, ExternalLinkIcon, SearchIcon } from "@/components/icons";

type RegistryRecord = {
  credentialIdHash: string;
  documentHash: string;
  issuer: string;
  issuedAt: number;
  revokedAt: number;
  expiresAt?: number;
  supersedes?: string;
  replacement?: string;
  transactionHash?: string | null;
  status: "valid" | "revoked" | "expired" | "replaced" | "unknown";
  institutionProfile: {
    id: string;
    name: string;
    category: string;
    wallet: string;
    website?: string;
    country?: string;
    verified: true;
    verificationMethod: string;
  } | null;
};

type ResultState = "idle" | "loading" | "ready" | "error";

function StatusIcon({ tone = "blue" }: { tone?: "blue" | "green" | "red" | "amber" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-lg ring-1 ${tones[tone]}`} aria-hidden="true">
      {tone === "green" ? (
        <CheckCircleIcon className="size-5" />
      ) : tone === "red" ? (
        <AlertCircleIcon className="size-5" />
      ) : tone === "amber" ? (
        <CircleHelpIcon className="size-5" />
      ) : (
        <SearchIcon className="size-5" />
      )}
    </span>
  );
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function VerificationDemo({
  initialCredentialId = "",
  initialNetworkKey,
  autoVerify = false,
}: {
  initialCredentialId?: string;
  initialNetworkKey?: BotNetworkKey;
  autoVerify?: boolean;
} = {}) {
  const { network, networkKey, selectNetwork } = useBotNetwork();
  const [credentialId, setCredentialId] = useState("");
  const [documentHash, setDocumentHash] = useState("");
  const [state, setState] = useState<ResultState>("idle");
  const [record, setRecord] = useState<RegistryRecord | null>(null);
  const [message, setMessage] = useState("");
  const [registryOnline, setRegistryOnline] = useState<boolean | null>(null);
  const automaticVerification = useRef("");

  useEffect(() => {
    if (initialNetworkKey) selectNetwork(initialNetworkKey);
    if (initialCredentialId) setCredentialId(initialCredentialId);
  }, [initialCredentialId, initialNetworkKey, selectNetwork]);

  useEffect(() => {
    let active = true;
    async function checkRegistry() {
      await Promise.resolve();
      if (!active) return;
      setRegistryOnline(null);
      setState("idle");
      setRecord(null);
      setMessage("");
      fetch(`/api/registry?network=${networkKey}`)
        .then((response) => response.json())
        .then((data) => active && setRegistryOnline(Boolean(data.available)))
        .catch(() => active && setRegistryOnline(false));
    }
    void checkRegistry();
    return () => {
      active = false;
    };
  }, [networkKey]);

  const verifyCredential = useCallback(async (credentialOverride?: string) => {
    const candidate = credentialOverride ?? credentialId;
    setState("loading");
    setRecord(null);
    setMessage("");

    if (documentHash && !isHexString(documentHash, 32)) {
      setMessage("The document fingerprint must be a 32-byte hexadecimal value beginning with 0x.");
      setState("error");
      return;
    }

    try {
      const response = await fetch(`/api/registry?network=${networkKey}&credentialId=${encodeURIComponent(candidate)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setRecord(data);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification could not be completed.");
      setState("error");
    }
  }, [credentialId, documentHash, networkKey]);

  useEffect(() => {
    if (!autoVerify || !initialCredentialId || registryOnline !== true) return;
    if (initialNetworkKey && initialNetworkKey !== networkKey) return;
    const key = `${networkKey}:${initialCredentialId}`;
    if (automaticVerification.current === key) return;
    automaticVerification.current = key;
    void verifyCredential(initialCredentialId);
  }, [autoVerify, initialCredentialId, initialNetworkKey, networkKey, registryOnline, verifyCredential]);

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verifyCredential();
  }

  const fingerprintMatches = record && documentHash
    ? record.documentHash.toLowerCase() === documentHash.toLowerCase()
    : null;

  function downloadReceipt() {
    if (!record || record.status === "unknown") return;
    downloadVerificationReceipt({
      credentialIdHash: record.credentialIdHash,
      status: record.status,
      issuer: record.issuer,
      institution: record.institutionProfile?.name ?? "Authorised issuer",
      documentCheck: fingerprintMatches === null
        ? "Not supplied"
        : fingerprintMatches
          ? "Fingerprint matched"
          : "Fingerprint mismatch",
      network: network.name,
      chainId: network.chainId,
      registryAddress: registryAddressForNetwork(networkKey),
      transactionHash: record.transactionHash,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      replacement: record.replacement,
      verifiedAt: new Date(),
    });
  }

  const resultTitle = record?.status === "revoked"
    ? "Credential revoked"
    : record?.status === "expired"
      ? "Credential expired"
      : record?.status === "replaced"
        ? "Credential replaced"
        : fingerprintMatches === false
          ? "Document does not match"
          : "Credential verified";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="verification-title">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <StatusIcon />
          <div>
            <h2 id="verification-title" className="text-sm font-semibold text-slate-950">Verify a credential</h2>
            <p className="mt-0.5 text-xs text-slate-500">Read directly from the {network.name} registry</p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${registryOnline === true ? "border-emerald-200 bg-emerald-50 text-emerald-700" : registryOnline === false ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {registryOnline === true ? "Registry online" : registryOnline === false ? "Unavailable" : "Checking"}
        </span>
      </header>

      <div className="p-5 sm:p-6">
        <form onSubmit={verify} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Credential ID</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">Enter the identifier supplied by the issuing institution.</span>
            <input
              value={credentialId}
              onChange={(event) => {
                setCredentialId(event.target.value);
                setState("idle");
              }}
              required
              placeholder="Enter credential ID"
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Document fingerprint <span className="font-normal text-slate-400">(optional)</span></span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">Add a SHA-256 fingerprint to confirm that a document matches the registered copy.</span>
            <input
              value={documentHash}
              onChange={(event) => {
                setDocumentHash(event.target.value.trim());
                setState("idle");
              }}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <button
            type="submit"
            disabled={state === "loading" || registryOnline === false}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {state === "loading" ? "Checking registry…" : "Verify record"}
          </button>
        </form>

        {state === "error" && (
          <div className="mt-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
            <StatusIcon tone="red" />
            <div><strong className="block text-sm font-semibold text-slate-900">Verification unavailable</strong><span className="mt-1 block text-xs leading-5 text-slate-600">{message}</span></div>
          </div>
        )}

        {state === "ready" && record?.status === "unknown" && (
          <div className="mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4" role="status">
            <StatusIcon tone="amber" />
            <div><strong className="block text-sm font-semibold text-slate-900">No registry record found</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Confirm the ID with the issuing institution before relying on this credential.</span></div>
          </div>
        )}

        {state === "ready" && record && record.status !== "unknown" && (
          <div className={`mt-5 rounded-lg border p-4 ${record.status === "valid" && fingerprintMatches !== false ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`} role="status">
            <div className="flex items-center gap-3">
              <StatusIcon tone={record.status === "valid" && fingerprintMatches !== false ? "green" : "red"} />
              <div>
                <strong className="block text-sm font-semibold text-slate-900">{resultTitle}</strong>
                <span className="text-xs text-slate-600">This result was returned by the deployed registry contract.</span>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-2">
              <div className="bg-white px-3 py-2.5"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Registry status</dt><dd className={`mt-1 text-xs font-semibold capitalize ${record.status === "valid" ? "text-emerald-700" : record.status === "revoked" ? "text-red-700" : "text-amber-700"}`}>{record.status}</dd></div>
              <div className="bg-white px-3 py-2.5"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Issued</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{new Date(record.issuedAt * 1000).toLocaleString()}</dd></div>
              <div className="bg-white px-3 py-2.5"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Issuing institution</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{record.institutionProfile?.name ?? "Authorised issuer"}</dd>{record.institutionProfile?.verified && <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Verified profile</span>}</div>
              <div className="bg-white px-3 py-2.5"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Issuer wallet</dt><dd className="mt-1 font-mono text-xs font-semibold text-slate-800" title={record.issuer}>{shortHash(record.issuer)}</dd></div>
              <div className="bg-white px-3 py-2.5"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Document check</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{fingerprintMatches === null ? "Not supplied" : fingerprintMatches ? "Fingerprint matched" : "Fingerprint mismatch"}</dd></div>
              {record.expiresAt && record.expiresAt > 0 ? <div className="bg-white px-3 py-2.5"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Expiry</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{new Date(record.expiresAt * 1000).toLocaleString()}</dd></div> : null}
              {record.status === "replaced" && record.replacement ? <div className="bg-white px-3 py-2.5"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Replacement</dt><dd className="mt-1 font-mono text-xs font-semibold text-slate-800" title={record.replacement}>{shortHash(record.replacement)}</dd></div> : null}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200" href={registryExplorerUrl(network)} target="_blank" rel="noreferrer">View contract <ExternalLinkIcon className="size-4" /></a>
              <button type="button" onClick={downloadReceipt} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"><DownloadIcon className="size-4" />Download PDF receipt</button>
            </div>
          </div>
        )}

        <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">EduTrust hashes the credential ID before lookup. Student names, grades and certificate files are not requested or returned by the public registry.</p>
      </div>
    </section>
  );
}
