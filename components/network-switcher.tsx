"use client";

import { useBotNetwork } from "@/components/network-provider";
import type { BotNetworkKey } from "@/lib/registry";

const options: Array<{ key: BotNetworkKey; label: string }> = [
  { key: "mainnet", label: "Mainnet" },
  { key: "testnet", label: "Testnet" },
];

export function NetworkSwitcher({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { networkKey, selectNetwork } = useBotNetwork();

  return (
    <div className={`inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 ${className}`} role="group" aria-label="BOT Chain network">
      {options.map((option) => {
        const selected = option.key === networkKey;
        return (
          <button
            type="button"
            key={option.key}
            aria-pressed={selected}
            onClick={() => selectNetwork(option.key)}
            className={`${compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"} rounded-md font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 ${selected ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
