"use client";

import { useMemo, useState } from "react";
import { BrowserProvider, Contract, id as hashText, isHexString } from "ethers";
import { useAppKitAccount, useAppKitProvider, type Provider } from "@reown/appkit/react";
import { useBotNetwork } from "@/components/network-provider";
import { ensureBotChain, type WalletRequestProvider } from "@/lib/wallet-network";
import { friendlyTransactionError } from "@/lib/transaction-errors";
import { REGISTRY_ABI, registryAddressForNetwork } from "@/lib/registry";
import { AlertCircleIcon, CheckCircleIcon, FileTextIcon } from "@/components/icons";

type BulkRow = {
  credentialId: string;
  documentHash: string;
  status: "pending" | "issuing" | "confirmed" | "failed";
  message?: string;
};

function columns(line: string) {
  const result: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      result.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  result.push(value.trim());
  return result;
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("The CSV must include a header and at least one credential.");
  const header = columns(lines[0]).map((item) => item.toLowerCase().replace(/[^a-z]/g, ""));
  const idIndex = header.indexOf("credentialid");
  const hashIndex = header.indexOf("documenthash");
  if (idIndex < 0 || hashIndex < 0) {
    throw new Error("Use the columns credentialId and documentHash.");
  }

  const seen = new Set<string>();
  return lines.slice(1).map((line, index) => {
    const values = columns(line);
    const credentialId = values[idIndex]?.trim();
    const documentHash = values[hashIndex]?.trim();
    if (!credentialId) throw new Error(`Row ${index + 2} has no credential ID.`);
    if (!isHexString(documentHash, 32)) throw new Error(`Row ${index + 2} needs a 32-byte SHA-256 document hash.`);
    const key = hashText(credentialId);
    if (seen.has(key)) throw new Error(`Row ${index + 2} duplicates credential ID ${credentialId}.`);
    seen.add(key);
    return { credentialId, documentHash, status: "pending" as const };
  });
}

export function BulkIssuance({ onComplete }: { onComplete: () => void }) {
  const { network, networkKey } = useBotNetwork();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { walletProvider } = useAppKitProvider<Provider>("eip155");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [message, setMessage] = useState("");
  const [issuing, setIssuing] = useState(false);

  const totals = useMemo(() => ({
    confirmed: rows.filter((row) => row.status === "confirmed").length,
    failed: rows.filter((row) => row.status === "failed").length,
  }), [rows]);

  async function selectCsv(file?: File) {
    setRows([]);
    setMessage("");
    if (!file) return;
    try {
      const nextRows = parseCsv(await file.text());
      if (nextRows.length > 100) throw new Error("Upload no more than 100 credentials at a time.");
      setRows(nextRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The CSV could not be read.");
    }
  }

  async function issueBatch() {
    if (!walletProvider || !isConnected || !address) {
      setMessage("Connect an authorised issuer wallet before starting the batch.");
      return;
    }

    setIssuing(true);
    setMessage("");
    let confirmed = 0;

    try {
      await ensureBotChain(walletProvider as WalletRequestProvider, network);
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const registry = new Contract(registryAddressForNetwork(networkKey), REGISTRY_ABI, signer);

      for (let index = 0; index < rows.length; index += 1) {
        if (rows[index].status === "confirmed") continue;
        setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: "issuing", message: "Waiting for wallet confirmation" } : row));
        try {
          const transaction = await registry["issueCredential(bytes32,bytes32)"](
            hashText(rows[index].credentialId),
            rows[index].documentHash,
          );
          await transaction.wait();
          confirmed += 1;
          setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: "confirmed", message: transaction.hash } : row));
        } catch (error) {
          const friendly = friendlyTransactionError(error, "issue", network.name);
          setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: "failed", message: friendly.message } : row));
        }
      }
    } catch (error) {
      const friendly = friendlyTransactionError(error, "issue", network.name);
      setMessage(friendly.message);
    } finally {
      setIssuing(false);
      if (confirmed > 0) onComplete();
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold text-blue-700">Registrar workflow</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Bulk issuance</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Import up to 100 prepared fingerprints. Each credential remains a separate, recoverable wallet transaction.</p>
      </div>

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
        <FileTextIcon className="size-6 text-slate-500" />
        <label className="mt-3 block text-sm font-semibold text-slate-800">
          Credential CSV
          <input type="file" accept=".csv,text/csv" onChange={(event) => selectCsv(event.target.files?.[0])} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
        </label>
        <p className="mt-2 text-xs leading-5 text-slate-500">Required header: <code>credentialId,documentHash</code>. Document hashes must be complete SHA-256 values beginning with 0x.</p>
      </div>

      {message && <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircleIcon className="mt-0.5 size-4 shrink-0" />{message}</div>}

      {rows.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600"><strong className="text-slate-900">{rows.length}</strong> prepared · <strong className="text-emerald-700">{totals.confirmed}</strong> confirmed · <strong className="text-red-700">{totals.failed}</strong> failed</p>
            <button disabled={issuing || rows.every((row) => row.status === "confirmed")} onClick={issueBatch} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400">
              {issuing ? "Processing batch…" : "Start batch issuance"}
            </button>
          </div>
          <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Credential</th><th className="px-4 py-3">Document hash</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map((row, index) => (
                <tr key={`${row.credentialId}-${index}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{row.credentialId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.documentHash.slice(0, 12)}…{row.documentHash.slice(-8)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${row.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : row.status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{row.status === "confirmed" && <CheckCircleIcon className="size-3.5" />}{row.status}</span>{row.status === "failed" && <p className="mt-1 max-w-sm text-xs leading-4 text-red-600">{row.message}</p>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        Your wallet will request approval for every row. Do not leave the page until the batch finishes; failed rows can be retried without repeating confirmed transactions.
      </div>
    </section>
  );
}
