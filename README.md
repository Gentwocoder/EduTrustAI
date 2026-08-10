# EduTrust AI

AI-assisted academic credential issuance, integrity screening and instant public verification secured by BOT Chain.

EduTrust AI is a standalone hackathon MVP. Institutions issue privacy-safe credential fingerprints on-chain, and employers can confirm credential status without contacting a registrar.

## What is included

- Premium responsive public product site
- Live public credential verification against selectable BOT Chain Mainnet and Testnet registries
- Institution credential dashboard
- Wallet-backed credential issuance and revocation
- Reown AppKit support for injected EIP-6963 wallets, WalletConnect QR/mobile wallets and Coinbase Wallet
- Privacy-focused Solidity registry
- Role-based institution issuer permissions
- BOT Chain testnet and Mainnet configuration
- Smart-contract compilation, deployment scripts and tests

## Privacy model

Student names, grades, emails and documents must never be published on-chain. The contract stores only:

- A one-way hash of the credential ID
- A one-way hash of the canonical document
- The authorised issuer wallet
- Issue and revocation timestamps
- The credential status

## Web application

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

The Reown project ID is public application metadata. The deployed project has a built-in default, and it can be overridden with `NEXT_PUBLIC_REOWN_PROJECT_ID` as shown in `.env.example`.

The public verifier reads the deployed registry contract and returns only canonical on-chain status. Open `/dashboard` to connect an authorised EVM wallet and submit issuance or revocation transactions.

## Smart contract

```bash
cd contracts
npm install
npm test
```

BOT Chain is EVM-compatible, so the contract uses Solidity and Hardhat.

| Network | Chain ID | RPC | Explorer |
| --- | ---: | --- | --- |
| Testnet | 968 | `https://rpc.bohr.life` | `https://scan.bohr.life` |
| Mainnet | 677 | `https://rpc.botchain.ai` | `https://scan.botchain.ai` |

Deployment instructions are in [`contracts/README.md`](contracts/README.md). Never commit a private key or seed phrase.

## Current MVP boundary

The verifier and issuance flow can switch between BOT Chain Mainnet and Testnet, with Mainnet selected by default. Institutional profiles, private academic records, generated credential PDFs, QR codes and OCR/AI document extraction remain outside the current standalone MVP.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system boundaries and data flow
- [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) — three-minute judging demonstration
- [BOT Chain developer quick guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/)
