export type BotNetworkKey = "mainnet" | "testnet";

export type BotNetwork = {
  key: BotNetworkKey;
  shortName: "Mainnet" | "Testnet";
  chainId: number;
  chainIdHex: string;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  deploymentBlock: number;
};

export const BOT_NETWORKS = {
  mainnet: {
    key: "mainnet",
    shortName: "Mainnet",
    chainId: 677,
    chainIdHex: "0x2a5",
    name: "BOT Chain Mainnet",
    rpcUrl: "https://rpc.botchain.ai",
    explorerUrl: "https://scan.botchain.ai",
    deploymentBlock: 19177944,
  },
  testnet: {
    key: "testnet",
    shortName: "Testnet",
    chainId: 968,
    chainIdHex: "0x3c8",
    name: "BOT Chain Testnet",
    rpcUrl: "https://rpc.bohr.life",
    explorerUrl: "https://scan.bohr.life",
    deploymentBlock: 0,
  },
} as const satisfies Record<BotNetworkKey, BotNetwork>;

export const DEFAULT_NETWORK_KEY: BotNetworkKey = "mainnet";

export function isBotNetworkKey(value: string | null): value is BotNetworkKey {
  return value === "mainnet" || value === "testnet";
}

export const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_EDUTRUST_REGISTRY_ADDRESS ??
  "0x49F1D0F56b9d7217fea0C4E0abAf64200b86505f";

export const DEFAULT_ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const ISSUER_ROLE =
  "0x114e74f6ea3bd819998f78687bfcb11b140da08e9b7d222fa9c1f1ba1f2aa122";

export const REGISTRY_ABI = [
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error AccessControlBadConfirmation()",
  "error CredentialAlreadyExists(bytes32 credentialIdHash)",
  "error CredentialNotFound(bytes32 credentialIdHash)",
  "error CredentialAlreadyRevoked(bytes32 credentialIdHash)",
  "error EmptyHash()",
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
  "event CredentialIssued(bytes32 indexed credentialIdHash, bytes32 indexed documentHash, address indexed issuer, uint64 issuedAt)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function issueCredential(bytes32 credentialIdHash, bytes32 documentHash)",
  "function revokeCredential(bytes32 credentialIdHash, bytes32 reasonHash)",
  "function getCredential(bytes32 credentialIdHash) view returns (bytes32 documentHash, address issuer, uint64 issuedAt, uint64 revokedAt, uint8 status)",
] as const;

export function registryExplorerUrl(network: BotNetwork) {
  return `${network.explorerUrl}/address/${REGISTRY_ADDRESS}`;
}
