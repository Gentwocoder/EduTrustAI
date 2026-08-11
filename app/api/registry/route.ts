import {
  Contract,
  EventLog,
  JsonRpcProvider,
  ZeroHash,
  id as hashText,
  isAddress,
  isHexString,
} from "ethers";
import {
  BOT_NETWORKS,
  DEFAULT_ADMIN_ROLE,
  DEFAULT_NETWORK_KEY,
  ISSUER_ROLE,
  isBotNetworkKey,
  REGISTRY_ABI,
  registryAddressForNetwork,
} from "@/lib/registry";
import { institutionProfileForWallet } from "@/lib/institutions";

export const dynamic = "force-dynamic";

function credentialStatus(status: number) {
  if (status === 1) return "valid";
  if (status === 2) return "revoked";
  if (status === 3) return "expired";
  if (status === 4) return "replaced";
  return "unknown";
}

async function resolveRegistryVersion(registry: Contract) {
  try {
    const version = Number(await registry.contractVersion());
    return Number.isSafeInteger(version) && version >= 2 ? version : 1;
  } catch {
    return 1;
  }
}

type IssuerRoleEvent = {
  account: string;
  changedBy: string;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  active: boolean;
};

function roleEvent(log: EventLog, active: boolean): IssuerRoleEvent {
  return {
    account: String(log.args.account),
    changedBy: String(log.args.sender),
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.index,
    active,
  };
}

async function lifecycleFor(
  registry: Contract,
  registryVersion: number,
  credentialIdHash: string,
) {
  if (registryVersion < 2) {
    return {
      expiresAt: 0,
      supersedes: ZeroHash,
      replacement: ZeroHash,
      status: undefined,
    };
  }

  const lifecycle = await registry.getCredentialLifecycle(credentialIdHash);
  return {
    expiresAt: Number(lifecycle.expiresAt),
    supersedes: String(lifecycle.supersedes),
    replacement: String(lifecycle.replacement),
    status: Number(lifecycle.effectiveStatus),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedNetwork = url.searchParams.get("network");
    if (requestedNetwork && !isBotNetworkKey(requestedNetwork)) {
      return Response.json({ message: "Choose either BOT Chain Mainnet or Testnet." }, { status: 400 });
    }

    const networkKey = isBotNetworkKey(requestedNetwork) ? requestedNetwork : DEFAULT_NETWORK_KEY;
    const selectedNetwork = BOT_NETWORKS[networkKey];
    const registryAddress = registryAddressForNetwork(networkKey);
    const provider = new JsonRpcProvider(selectedNetwork.rpcUrl, selectedNetwork.chainId, {
      staticNetwork: true,
    });
    const registry = new Contract(registryAddress, REGISTRY_ABI, provider);
    const registryVersion = await resolveRegistryVersion(registry);
    const credentialId = url.searchParams.get("credentialId")?.trim();
    const issuer = url.searchParams.get("issuer")?.trim();
    const account = url.searchParams.get("account")?.trim();
    const rolesRequested = url.searchParams.get("roles") === "true";

    if (rolesRequested) {
      if (!account || !isAddress(account)) {
        return Response.json({ message: "Connect a valid wallet to check registry access." }, { status: 400 });
      }

      const [isAdmin, isIssuer, grantedLogs, revokedLogs] = await Promise.all([
        registry.hasRole(DEFAULT_ADMIN_ROLE, account),
        registry.hasRole(ISSUER_ROLE, account),
        registry.queryFilter(
          registry.filters.RoleGranted(ISSUER_ROLE),
          selectedNetwork.deploymentBlock,
          "latest",
        ),
        registry.queryFilter(
          registry.filters.RoleRevoked(ISSUER_ROLE),
          selectedNetwork.deploymentBlock,
          "latest",
        ),
      ]);

      const history = [
        ...grantedLogs
          .filter((log): log is EventLog => log instanceof EventLog)
          .map((log) => roleEvent(log, true)),
        ...revokedLogs
          .filter((log): log is EventLog => log instanceof EventLog)
          .map((log) => roleEvent(log, false)),
      ].sort((left, right) => (
        left.blockNumber - right.blockNumber || left.logIndex - right.logIndex
      ));

      const latestByAccount = new Map<string, IssuerRoleEvent>();
      for (const item of history) latestByAccount.set(item.account.toLowerCase(), item);

      const issuerChecks = await Promise.all(
        [...latestByAccount.values()]
          .filter((item) => item.active)
          .map(async (item) => ({
            ...item,
            active: Boolean(await registry.hasRole(ISSUER_ROLE, item.account)),
          })),
      );

      const issuers = issuerChecks
        .filter((item) => item.active)
        .sort((left, right) => right.blockNumber - left.blockNumber)
        .map((item) => ({
          ...item,
          profile: institutionProfileForWallet(item.account),
        }));

      return Response.json({
        account: {
          address: account,
          isAdmin: Boolean(isAdmin),
          isIssuer: Boolean(isIssuer),
          profile: institutionProfileForWallet(account),
        },
        issuers,
        network: selectedNetwork.name,
        networkKey: selectedNetwork.key,
        registryVersion,
        contractAddress: registryAddress,
      });
    }

    if (issuer) {
      if (!isAddress(issuer)) {
        return Response.json({ message: "A valid issuer wallet address is required." }, { status: 400 });
      }

      const filter = registry.filters.CredentialIssued(null, null, issuer);
      const logs = await registry.queryFilter(filter, selectedNetwork.deploymentBlock, "latest");
      const issuedCredentials = logs
        .filter((log): log is EventLog => log instanceof EventLog)
        .map((log) => ({
          credentialIdHash: String(log.args.credentialIdHash),
          documentHash: String(log.args.documentHash),
          issuer: String(log.args.issuer),
          issuedAt: Number(log.args.issuedAt),
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
        }))
        .reverse();

      const activity = await Promise.all(
        issuedCredentials.map(async (item) => {
          const [record, lifecycle] = await Promise.all([
            registry.getCredential(item.credentialIdHash),
            lifecycleFor(registry, registryVersion, item.credentialIdHash),
          ]);
          const statusNumber = lifecycle.status ?? Number(record.status);
          return {
            ...item,
            revokedAt: Number(record.revokedAt),
            expiresAt: lifecycle.expiresAt,
            supersedes: lifecycle.supersedes,
            replacement: lifecycle.replacement,
            status: credentialStatus(statusNumber),
          };
        }),
      );

      return Response.json({ activity, registryVersion, contractAddress: registryAddress });
    }

    if (!credentialId) {
      const [network, code] = await Promise.all([
        provider.getNetwork(),
        provider.getCode(registryAddress),
      ]);

      return Response.json({
        available: code !== "0x",
        chainId: Number(network.chainId),
        network: selectedNetwork.name,
        networkKey: selectedNetwork.key,
        contractAddress: registryAddress,
        registryVersion,
      });
    }

    const credentialIdHash = isHexString(credentialId, 32)
      ? credentialId
      : hashText(credentialId);
    const [record, lifecycle, issuedLogs] = await Promise.all([
      registry.getCredential(credentialIdHash),
      lifecycleFor(registry, registryVersion, credentialIdHash),
      registry.queryFilter(
        registry.filters.CredentialIssued(credentialIdHash, null, null),
        selectedNetwork.deploymentBlock,
        "latest",
      ),
    ]);
    const issuedEvent = issuedLogs
      .filter((log): log is EventLog => log instanceof EventLog)
      .at(-1);
    const statusNumber = lifecycle.status ?? Number(record.status);

    return Response.json({
      credentialIdHash,
      documentHash: record.documentHash,
      issuer: record.issuer,
      institutionProfile: institutionProfileForWallet(String(record.issuer)),
      issuedAt: Number(record.issuedAt),
      revokedAt: Number(record.revokedAt),
      expiresAt: lifecycle.expiresAt,
      supersedes: lifecycle.supersedes,
      replacement: lifecycle.replacement,
      transactionHash: issuedEvent?.transactionHash ?? null,
      status: credentialStatus(statusNumber),
      registryVersion,
      contractAddress: registryAddress,
    });
  } catch (error) {
    console.error("BOT registry request failed", error);
    return Response.json(
      { message: "The selected BOT Chain registry could not be reached. Please try again." },
      { status: 502 },
    );
  }
}
