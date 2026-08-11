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
    deploymentBlock: 19280977,
  },
  testnet: {
    key: "testnet",
    shortName: "Testnet",
    chainId: 968,
    chainIdHex: "0x3c8",
    name: "BOT Chain Testnet",
    rpcUrl: "https://rpc.bohr.life",
    explorerUrl: "https://scan.bohr.life",
    deploymentBlock: 19475372,
  },
} as const satisfies Record<BotNetworkKey, BotNetwork>;

export const DEFAULT_NETWORK_KEY: BotNetworkKey = "mainnet";

export function isBotNetworkKey(value: string | null): value is BotNetworkKey {
  return value === "mainnet" || value === "testnet";
}

const DEFAULT_REGISTRY_ADDRESSES = {
  mainnet: "0x3032b61c1e44bb8b1CF41fF4345ad5Dc4DEAD48C",
  testnet: "0xc3B43f3834b70a35da368D17C6bFCCb46FC8ebf3",
} as const satisfies Record<BotNetworkKey, string>;

const sharedRegistryOverride = process.env.NEXT_PUBLIC_EDUTRUST_REGISTRY_ADDRESS;

export const REGISTRY_ADDRESSES = {
  mainnet:
    process.env.NEXT_PUBLIC_EDUTRUST_MAINNET_REGISTRY_ADDRESS ??
    sharedRegistryOverride ??
    DEFAULT_REGISTRY_ADDRESSES.mainnet,
  testnet:
    process.env.NEXT_PUBLIC_EDUTRUST_TESTNET_REGISTRY_ADDRESS ??
    sharedRegistryOverride ??
    DEFAULT_REGISTRY_ADDRESSES.testnet,
} as const satisfies Record<BotNetworkKey, string>;

// Retained for compatibility with code that only needs the default Mainnet address.
export const REGISTRY_ADDRESS = REGISTRY_ADDRESSES.mainnet;

export function registryAddressForNetwork(networkKey: BotNetworkKey) {
  return REGISTRY_ADDRESSES[networkKey];
}

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
  "error CredentialNotActive(bytes32 credentialIdHash)",
  "error InvalidExpiry(uint64 expiresAt)",
  "error InvalidAdmin()",
  "error NotPendingAdmin(address account)",
  "error EmptyHash()",
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
  "event CredentialIssued(bytes32 indexed credentialIdHash, bytes32 indexed documentHash, address indexed issuer, uint64 issuedAt)",
  "event CredentialRenewed(bytes32 indexed credentialIdHash, bytes32 indexed replacementCredentialIdHash, address indexed issuer, uint64 renewedAt)",
  "event CredentialCorrected(bytes32 indexed credentialIdHash, bytes32 indexed replacementCredentialIdHash, address indexed issuer, uint64 correctedAt)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function issueCredential(bytes32 credentialIdHash, bytes32 documentHash)",
  "function issueCredential(bytes32 credentialIdHash, bytes32 documentHash, uint64 expiresAt)",
  "function revokeCredential(bytes32 credentialIdHash, bytes32 reasonHash)",
  "function renewCredential(bytes32 credentialIdHash, bytes32 replacementCredentialIdHash, bytes32 replacementDocumentHash, uint64 expiresAt)",
  "function correctCredential(bytes32 credentialIdHash, bytes32 replacementCredentialIdHash, bytes32 replacementDocumentHash, uint64 expiresAt)",
  "function getCredential(bytes32 credentialIdHash) view returns (bytes32 documentHash, address issuer, uint64 issuedAt, uint64 revokedAt, uint8 status)",
  "function getCredentialLifecycle(bytes32 credentialIdHash) view returns (uint64 expiresAt, bytes32 supersedes, bytes32 replacement, uint8 effectiveStatus)",
  "function contractVersion() pure returns (uint8)",
  "function primaryAdmin() view returns (address)",
  "function pendingAdmin() view returns (address)",
  "function proposeAdminRotation(address newAdmin)",
  "function acceptAdminRotation()",
] as const;

export function registryExplorerUrl(network: BotNetwork) {
  return `${network.explorerUrl}/address/${registryAddressForNetwork(network.key)}`;
}
