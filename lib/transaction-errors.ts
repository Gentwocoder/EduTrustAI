export type TransactionAction = "issue" | "revoke";

export type FriendlyTransactionError = {
  title: string;
  message: string;
};

function collectErrorDetails(
  value: unknown,
  seen = new Set<unknown>(),
  depth = 0,
): string[] {
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }

  if (!value || typeof value !== "object" || depth > 4 || seen.has(value)) {
    return [];
  }

  seen.add(value);
  const details: string[] = [];

  if (value instanceof Error) {
    details.push(value.name, value.message);
  }

  const record = value as Record<string, unknown>;
  for (const key of [
    "code",
    "message",
    "shortMessage",
    "reason",
    "data",
    "error",
    "info",
    "cause",
    "revert",
  ]) {
    if (key in record) {
      details.push(...collectErrorDetails(record[key], seen, depth + 1));
    }
  }

  return details;
}

function hasAny(details: string, values: string[]) {
  return values.some((value) => details.includes(value.toLowerCase()));
}

export function friendlyTransactionError(
  error: unknown,
  action: TransactionAction,
  networkName: string,
): FriendlyTransactionError {
  const details = collectErrorDetails(error).join(" ").toLowerCase();

  if (hasAny(details, [
    "accesscontrolunauthorizedaccount",
    "0xe2517d3f",
  ])) {
    return action === "issue"
      ? {
          title: "Wallet not authorised",
          message: `This wallet cannot issue credentials on ${networkName}. Connect your institution's approved issuer wallet or ask the registry administrator to grant this wallet issuer access.`,
        }
      : {
          title: "Revocation not permitted",
          message: "Use the wallet that originally issued this credential, or ask the registry administrator to revoke it.",
        };
  }

  if (hasAny(details, [
    "credentialalreadyexists",
    "0x87dbb506",
  ])) {
    return {
      title: "Credential already registered",
      message: "A credential with this ID already exists. Check the existing record or use a different credential ID.",
    };
  }

  if (hasAny(details, [
    "credentialnotfound",
    "0x0d99a0d1",
  ])) {
    return {
      title: "Credential not found",
      message: `This credential was not found on ${networkName}. Confirm that the correct network is selected and try again.`,
    };
  }

  if (hasAny(details, [
    "credentialalreadyrevoked",
    "0xaac64f45",
  ])) {
    return {
      title: "Credential already revoked",
      message: "This credential has already been revoked. No further action is required.",
    };
  }

  if (hasAny(details, [
    "action_rejected",
    "user rejected",
    "user denied",
    "request rejected",
    "request denied",
    "4001",
  ])) {
    return {
      title: "Request cancelled",
      message: "The request was cancelled in your wallet. No changes were made.",
    };
  }

  if (hasAny(details, [
    "insufficient funds",
    "insufficientfunds",
  ])) {
    return {
      title: "Not enough BOT for the network fee",
      message: `Add enough BOT to this wallet for transaction fees on ${networkName}, then try again.`,
    };
  }

  if (hasAny(details, [
    "walletnetworkerror",
    "could not prepare",
    "could not switch",
    "did not finish switching",
    "add-network",
    "switch-network",
    "chain disconnected",
    "network disconnected",
  ])) {
    return {
      title: "Network connection needed",
      message: `Open your wallet, approve the ${networkName} network request, and try again.`,
    };
  }

  if (hasAny(details, [
    "call_exception",
    "execution reverted",
    "estimateGas",
    "missing revert data",
  ].map((value) => value.toLowerCase()))) {
    return {
      title: "Transaction could not be completed",
      message: `The blockchain rejected this request. Confirm that the connected wallet has permission and that ${networkName} is selected, then try again.`,
    };
  }

  return {
    title: "Something went wrong",
    message: "We could not complete the transaction. Check your wallet connection and try again.",
  };
}
