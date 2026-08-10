"use client";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import {
  BOT_APPKIT_NETWORKS,
  REOWN_PROJECT_ID,
  botChainMainnet,
} from "@/lib/appkit";

createAppKit({
  adapters: [new EthersAdapter()],
  networks: BOT_APPKIT_NETWORKS,
  defaultNetwork: botChainMainnet,
  projectId: REOWN_PROJECT_ID,
  metadata: {
    name: "EduTrust AI",
    description: "Academic credential issuance and verification secured by BOT Chain.",
    url: "https://edu-trust-ai.vercel.app",
    icons: ["https://edu-trust-ai.vercel.app/favicon.svg"],
  },
  defaultAccountTypes: { eip155: "eoa" },
  coinbasePreference: "eoaOnly",
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
    send: false,
    receive: false,
    allWallets: true,
  },
  themeMode: "light",
  themeVariables: {
    "--w3m-accent": "#2563eb",
    "--w3m-border-radius-master": "2px",
  },
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return children;
}
