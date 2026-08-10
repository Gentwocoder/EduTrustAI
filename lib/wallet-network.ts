import type { BotNetwork } from "@/lib/registry";

export type WalletRequestProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type WalletNetworkErrorReason =
  | "rejected"
  | "pending"
  | "unsupported"
  | "switch-failed";

export class WalletNetworkError extends Error {
  constructor(
    message: string,
    public readonly reason: WalletNetworkErrorReason,
  ) {
    super(message);
    this.name = "WalletNetworkError";
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    if (typeof record.message === "string") {
      return record.message;
    }

    for (const key of ["error", "cause", "data", "info"]) {
      if (record[key] && record[key] !== error) {
        const nestedMessage = errorMessage(record[key]);
        if (nestedMessage !== "Unknown wallet error") {
          return nestedMessage;
        }
      }
    }
  }

  return "Unknown wallet error";
}

function errorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const record = error as Record<string, unknown>;

  if (typeof record.code === "number") {
    return record.code;
  }

  if (typeof record.code === "string") {
    const parsed = Number(record.code);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  for (const key of ["error", "cause", "data", "info"]) {
    if (record[key] && record[key] !== error) {
      const nestedCode = errorCode(record[key]);
      if (nestedCode !== undefined) {
        return nestedCode;
      }
    }
  }

  return undefined;
}

function matchesError(error: unknown, pattern: RegExp, codes: number[] = []) {
  const code = errorCode(error);
  return (code !== undefined && codes.includes(code)) || pattern.test(errorMessage(error));
}

function isRejected(error: unknown) {
  return matchesError(
    error,
    /user (rejected|denied)|request (rejected|denied)|declined/i,
    [4001],
  );
}

function isPending(error: unknown) {
  return matchesError(error, /already pending|request.*pending/i, [-32002]);
}

function isUnsupported(error: unknown) {
  return matchesError(
    error,
    /method not found|unsupported method|method.*not supported/i,
    [4200, -32601],
  );
}

function isAlreadyAdded(error: unknown) {
  return matchesError(error, /chain.*(already added|already exists)|already.*chain/i);
}

function normalizedChainId(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function addChainParameters(network: Readonly<BotNetwork>) {
  return {
    chainId: network.chainIdHex,
    chainName: network.name,
    nativeCurrency: {
      name: "BOT",
      symbol: "BOT",
      decimals: 18,
    },
    rpcUrls: [network.rpcUrl],
    blockExplorerUrls: [network.explorerUrl],
  };
}

function rejectedMessage(network: Readonly<BotNetwork>) {
  return `The ${network.name} request was declined in your wallet. Approve both the add-network and switch-network prompts to continue.`;
}

function pendingMessage(network: Readonly<BotNetwork>) {
  return `A ${network.name} request is already waiting in your wallet. Open the wallet extension or app and complete that request.`;
}

export async function ensureBotChain(
  provider: WalletRequestProvider,
  network: Readonly<BotNetwork>,
): Promise<{ added: boolean; switched: boolean }> {
  const targetChainId = BigInt(network.chainId);
  const currentChainId = normalizedChainId(
    await provider.request({ method: "eth_chainId" }),
  );

  if (currentChainId === targetChainId) {
    return { added: false, switched: false };
  }

  let added = false;
  let addError: unknown;

  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [addChainParameters(network)],
    });
    added = true;
  } catch (error) {
    if (isRejected(error)) {
      throw new WalletNetworkError(rejectedMessage(network), "rejected");
    }

    if (isPending(error)) {
      throw new WalletNetworkError(pendingMessage(network), "pending");
    }

    if (!isUnsupported(error) && !isAlreadyAdded(error)) {
      addError = error;
    }
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: network.chainIdHex }],
    });
  } catch (error) {
    if (isRejected(error)) {
      throw new WalletNetworkError(rejectedMessage(network), "rejected");
    }

    if (isPending(error)) {
      throw new WalletNetworkError(pendingMessage(network), "pending");
    }

    const detail = errorMessage(error);
    const addDetail = addError ? ` The add-network request also returned: ${errorMessage(addError)}.` : "";

    throw new WalletNetworkError(
      `Your wallet could not switch to ${network.name}. Open the wallet's network settings and add chain ID ${network.chainId} with RPC ${network.rpcUrl}, then try again. Wallet response: ${detail}.${addDetail}`,
      isUnsupported(error) ? "unsupported" : "switch-failed",
    );
  }

  const selectedChainId = normalizedChainId(
    await provider.request({ method: "eth_chainId" }),
  );

  if (selectedChainId !== targetChainId) {
    throw new WalletNetworkError(
      `Your wallet did not finish switching to ${network.name}. Open the wallet and approve the pending network request.`,
      "switch-failed",
    );
  }

  return { added, switched: true };
}

export function walletNetworkErrorMessage(
  error: unknown,
  network: Readonly<BotNetwork>,
) {
  if (error instanceof WalletNetworkError) {
    return error.message;
  }

  if (isRejected(error)) {
    return rejectedMessage(network);
  }

  if (isPending(error)) {
    return pendingMessage(network);
  }

  return `Could not prepare ${network.name}. ${errorMessage(error)}`;
}

export function walletConnectionErrorMessage(error: unknown) {
  const message = errorMessage(error);

  if (/declin|reject|unsupported chain|proposal/i.test(message)) {
    return "The wallet session did not finish connecting. Reopen OKX or Bitget Wallet and approve the connection; EduTrust will add the selected BOT Chain immediately afterward.";
  }

  return message;
}
