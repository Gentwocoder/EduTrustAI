/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import type { BotNetworkKey } from "@/lib/registry";
import { CheckCircleIcon, ExternalLinkIcon, XIcon } from "@/components/icons";

export function CredentialQr({
  credentialIdHash,
  networkKey,
}: {
  credentialIdHash: string;
  networkKey: BotNetworkKey;
}) {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setShareUrl(`${window.location.origin}/verify/${networkKey}/${credentialIdHash}`);
  }, [credentialIdHash, networkKey]);

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const qrUrl = shareUrl
    ? `https://quickchart.io/qr?size=260&margin=2&ecLevel=M&text=${encodeURIComponent(shareUrl)}`
    : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        QR
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="qr-title">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="qr-title" className="text-base font-semibold text-slate-950">Credential verification QR</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Scanning opens the live {networkKey} registry result.</p>
              </div>
              <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Close QR code"><XIcon className="size-4" /></button>
            </div>

            <div className="mt-4 grid place-items-center rounded-xl border border-slate-200 bg-white p-4">
              {qrUrl && <img src={qrUrl} width={260} height={260} alt="QR code linking to credential verification" />}
            </div>
            <p className="mt-3 break-all rounded-md bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-600">{shareUrl}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={copyLink} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {copied ? <CheckCircleIcon className="size-4 text-emerald-600" /> : null}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                Open <ExternalLinkIcon className="size-4" />
              </a>
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">The QR image is rendered by QuickChart and contains only the public verification URL—never the source document.</p>
          </div>
        </div>
      )}
    </>
  );
}
