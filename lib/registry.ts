export const BOT_TESTNET = {
  chainId: 968,
  chainIdHex: "0x3c8",
  name: "BOT Chain Testnet",
  rpcUrl: "https://rpc.bohr.life",
  explorerUrl: "https://scan.bohr.life",
} as const;

export const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_EDUTRUST_REGISTRY_ADDRESS ??
  "0x49F1D0F56b9d7217fea0C4E0abAf64200b86505f";

export const REGISTRY_ABI = [
  "event CredentialIssued(bytes32 indexed credentialIdHash, bytes32 indexed documentHash, address indexed issuer, uint64 issuedAt)",
  "function issueCredential(bytes32 credentialIdHash, bytes32 documentHash)",
  "function revokeCredential(bytes32 credentialIdHash, bytes32 reasonHash)",
  "function getCredential(bytes32 credentialIdHash) view returns (bytes32 documentHash, address issuer, uint64 issuedAt, uint64 revokedAt, uint8 status)",
] as const;

export function registryExplorerUrl() {
  return `${BOT_TESTNET.explorerUrl}/address/${REGISTRY_ADDRESS}`;
}
