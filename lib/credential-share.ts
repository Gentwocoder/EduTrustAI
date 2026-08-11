import { getAddress, isAddress, isHexString, verifyMessage } from "ethers";
import { isBotNetworkKey, type BotNetworkKey } from "@/lib/registry";

export type CredentialSharePayload = {
  version: 1;
  network: BotNetworkKey;
  credentialIdHash: string;
  presenter: string;
  expiresAt: number;
};

type CredentialShareEnvelope = CredentialSharePayload & {
  signature: string;
};

export const MAX_SHARE_DURATION_SECONDS = 30 * 24 * 60 * 60;

export function credentialShareMessage(payload: CredentialSharePayload) {
  return [
    "EduTrust credential presentation",
    "Version: 1",
    `Network: ${payload.network}`,
    `Credential: ${payload.credentialIdHash.toLowerCase()}`,
    `Presenter: ${getAddress(payload.presenter)}`,
    `Expires: ${payload.expiresAt}`,
    "",
    "Signing creates a time-limited public verification link. It does not transfer funds or prove the signer owns the academic credential.",
  ].join("\n");
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createCredentialShareToken(
  payload: CredentialSharePayload,
  signature: string,
) {
  return encodeBase64Url(JSON.stringify({ ...payload, signature } satisfies CredentialShareEnvelope));
}

export type CredentialShareValidation =
  | { valid: true; payload: CredentialSharePayload }
  | { valid: false; reason: "invalid" | "expired" };

export function validateCredentialShareToken(
  token: string,
  now = Math.floor(Date.now() / 1000),
): CredentialShareValidation {
  try {
    const envelope = JSON.parse(decodeBase64Url(token)) as Partial<CredentialShareEnvelope>;
    if (
      envelope.version !== 1 ||
      !isBotNetworkKey(envelope.network ?? null) ||
      !isHexString(envelope.credentialIdHash, 32) ||
      !isAddress(envelope.presenter ?? "") ||
      typeof envelope.expiresAt !== "number" ||
      !Number.isSafeInteger(envelope.expiresAt) ||
      typeof envelope.signature !== "string"
    ) {
      return { valid: false, reason: "invalid" };
    }

    if (envelope.expiresAt <= now) return { valid: false, reason: "expired" };
    if (envelope.expiresAt - now > MAX_SHARE_DURATION_SECONDS + 300) {
      return { valid: false, reason: "invalid" };
    }

    const payload: CredentialSharePayload = {
      version: 1,
      network: envelope.network,
      credentialIdHash: envelope.credentialIdHash,
      presenter: getAddress(envelope.presenter),
      expiresAt: envelope.expiresAt,
    };
    const recovered = verifyMessage(
      credentialShareMessage(payload),
      envelope.signature,
    );
    if (getAddress(recovered) !== payload.presenter) {
      return { valid: false, reason: "invalid" };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: "invalid" };
  }
}
