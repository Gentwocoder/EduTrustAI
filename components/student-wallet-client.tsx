"use client";

import { StudentCredentialWallet } from "@/components/student-credential-wallet";
import { WalletProvider } from "@/components/wallet-provider";

export function StudentWalletClient() {
  return <WalletProvider><StudentCredentialWallet /></WalletProvider>;
}
