"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BOT_NETWORKS, DEFAULT_NETWORK_KEY, isBotNetworkKey, type BotNetwork, type BotNetworkKey } from "@/lib/registry";

type NetworkContextValue = {
  network: BotNetwork;
  networkKey: BotNetworkKey;
  selectNetwork: (networkKey: BotNetworkKey) => void;
};

const storageKey = "edutrust:network:v1";
const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkKey, setNetworkKey] = useState<BotNetworkKey>(DEFAULT_NETWORK_KEY);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      const savedNetwork = window.localStorage.getItem(storageKey);
      if (isBotNetworkKey(savedNetwork)) setNetworkKey(savedNetwork);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectNetwork = useCallback((nextNetwork: BotNetworkKey) => {
    setNetworkKey(nextNetwork);
    window.localStorage.setItem(storageKey, nextNetwork);
  }, []);

  const value = useMemo(() => ({
    network: BOT_NETWORKS[networkKey],
    networkKey,
    selectNetwork,
  }), [networkKey, selectNetwork]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useBotNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useBotNetwork must be used within NetworkProvider.");
  return context;
}
