import { Contract, JsonRpcProvider, id as hashText, isHexString } from "ethers";
import { BOT_TESTNET, REGISTRY_ABI, REGISTRY_ADDRESS } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Cloudflare requires network clients and their internal timers to be
    // created within the request lifecycle rather than at module scope.
    const provider = new JsonRpcProvider(BOT_TESTNET.rpcUrl, BOT_TESTNET.chainId, {
      staticNetwork: true,
    });
    const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
    const url = new URL(request.url);
    const credentialId = url.searchParams.get("credentialId")?.trim();

    if (!credentialId) {
      const [network, code] = await Promise.all([
        provider.getNetwork(),
        provider.getCode(REGISTRY_ADDRESS),
      ]);

      return Response.json({
        available: code !== "0x",
        chainId: Number(network.chainId),
        network: BOT_TESTNET.name,
        contractAddress: REGISTRY_ADDRESS,
      });
    }

    const credentialIdHash = isHexString(credentialId, 32)
      ? credentialId
      : hashText(credentialId);
    const record = await registry.getCredential(credentialIdHash);
    const status = Number(record.status);

    return Response.json({
      credentialIdHash,
      documentHash: record.documentHash,
      issuer: record.issuer,
      issuedAt: Number(record.issuedAt),
      revokedAt: Number(record.revokedAt),
      status: status === 1 ? "valid" : status === 2 ? "revoked" : "unknown",
    });
  } catch (error) {
    console.error("BOT registry request failed", error);
    return Response.json(
      { message: "The BOT Testnet registry could not be reached. Please try again." },
      { status: 502 },
    );
  }
}
