"use client";

import { useEffect, useState } from "react";
import { useBotNetwork } from "@/components/network-provider";
import { REGISTRY_ADDRESS, registryExplorerUrl } from "@/lib/registry";
import { ExternalLinkIcon } from "@/components/icons";

type RegistryHealth = {
  available: boolean;
  chainId: number;
};

function shortAddress(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function RegistryOverview() {
  const { network, networkKey } = useBotNetwork();
  const [health, setHealth] = useState<RegistryHealth | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkRegistry() {
      await Promise.resolve();
      if (!active) return;
      setHealth(null);
      setFailed(false);
      fetch(`/api/registry?network=${networkKey}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Registry unavailable");
          return response.json();
        })
        .then((data) => active && setHealth(data))
        .catch(() => active && setFailed(true));
    }
    void checkRegistry();
    return () => {
      active = false;
    };
  }, [networkKey]);

  const items = [
    {
      label: "Registry status",
      value: failed ? "Unavailable" : health?.available ? "Connected" : "Checking…",
      detail: "Live contract availability",
      tone: failed ? "text-red-700" : health?.available ? "text-emerald-700" : "text-slate-500",
    },
    {
      label: "Network",
      value: network.name,
      detail: `Chain ID ${health?.chainId ?? network.chainId}`,
      tone: "text-slate-950",
    },
    {
      label: "Registry contract",
      value: shortAddress(REGISTRY_ADDRESS),
      detail: "Deployed credential registry",
      tone: "font-mono text-slate-950",
      href: registryExplorerUrl(network),
    },
    {
      label: "Public access",
      value: "No account required",
      detail: "Read-only verification",
      tone: "text-slate-950",
    },
  ];

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-slate-200 border-x border-slate-200 sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
      {items.map((item) => (
        <div className="min-h-32 px-5 py-6 sm:px-7" key={item.label}>
          <span className="block text-xs font-semibold text-slate-600">{item.label}</span>
          {item.href ? (
            <a className={`mt-2 inline-flex items-center gap-2 text-lg font-semibold tracking-tight hover:text-blue-700 ${item.tone}`} href={item.href} target="_blank" rel="noreferrer">{item.value} <ExternalLinkIcon className="size-4" /></a>
          ) : (
            <strong className={`mt-2 block text-lg font-semibold tracking-tight ${item.tone}`}>{item.value}</strong>
          )}
          <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>
        </div>
      ))}
    </div>
  );
}
