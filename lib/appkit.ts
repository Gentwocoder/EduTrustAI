import {
  defineChain,
  mainnet,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { BOT_NETWORKS, type BotNetworkKey } from "@/lib/registry";

export const REOWN_PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "dbc555579a692e9a597971d5c1358b24";

export const botChainMainnet = defineChain({
  id: BOT_NETWORKS.mainnet.chainId,
  caipNetworkId: `eip155:${BOT_NETWORKS.mainnet.chainId}`,
  chainNamespace: "eip155",
  name: BOT_NETWORKS.mainnet.name,
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [BOT_NETWORKS.mainnet.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "BOTScan",
      url: BOT_NETWORKS.mainnet.explorerUrl,
    },
  },
});

export const botChainTestnet = defineChain({
  id: BOT_NETWORKS.testnet.chainId,
  caipNetworkId: `eip155:${BOT_NETWORKS.testnet.chainId}`,
  chainNamespace: "eip155",
  name: BOT_NETWORKS.testnet.name,
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [BOT_NETWORKS.testnet.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "BOTScan",
      url: BOT_NETWORKS.testnet.explorerUrl,
    },
  },
});

// Start the wallet session on a universally recognized EVM network. Once the
// account is connected, EduTrust explicitly adds and selects the chosen BOT
// Chain network through EIP-3085 and EIP-3326.
export const walletConnectionNetwork = mainnet;

export const BOT_APPKIT_NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [
  walletConnectionNetwork,
  botChainMainnet,
  botChainTestnet,
];

export const BOT_APPKIT_NETWORK_BY_KEY = {
  mainnet: botChainMainnet,
  testnet: botChainTestnet,
} satisfies Record<BotNetworkKey, AppKitNetwork>;
