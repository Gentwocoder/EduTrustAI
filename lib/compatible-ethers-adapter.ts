import { EthersAdapter } from "@reown/appkit-adapter-ethers";

/**
 * OKX and Bitget return eth_chainId as an EIP-1193 hex string. During
 * connection, the current Ethers adapter compares that response directly with
 * AppKit's numeric target and can issue wallet_switchEthereumChain before
 * eth_requestAccounts has fully settled.
 *
 * Keep the connection handshake account-only. The dashboard performs the real
 * BOT Chain add/switch after AppKit has closed its connection modal.
 */
export class CompatibleEthersAdapter extends EthersAdapter {
  async connect(params: Parameters<EthersAdapter["connect"]>[0]) {
    const connector = this.connectors.find(
      (item) => item.id.toLowerCase() === params.id.toLowerCase(),
    );
    const originalProvider = connector?.provider;

    if (!connector || !originalProvider || params.chainId === undefined || params.type === "AUTH") {
      return super.connect(params);
    }

    let connectionActive = true;
    const compatibilityProvider = new Proxy(originalProvider, {
      get(target, property, receiver) {
        if (property === "request") {
          return async <T,>(
            request: {
              readonly method: string;
              readonly params?: readonly unknown[] | object;
            },
          ): Promise<T> => {
            const value = await target.request<T>(request);

            if (connectionActive && request.method === "eth_chainId") {
              return params.chainId as T;
            }

            return value;
          };
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    connector.provider = compatibilityProvider;

    try {
      return await super.connect(params);
    } finally {
      connectionActive = false;
      connector.provider = originalProvider;
    }
  }
}
