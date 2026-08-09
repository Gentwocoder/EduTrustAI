# EduTrust AI

AI-assisted academic credential issuance, integrity screening and instant public verification secured by BOT Chain.

EduTrust AI is a standalone hackathon MVP from Lenage Technologies. Institutions issue privacy-safe credential fingerprints on-chain; graduates share a verification link; employers confirm validity without contacting a registrar; and an AI comparison flow highlights suspicious document alterations.

## What is included

- Premium responsive public product site
- Public credential verification demo
- Altered-document comparison demo
- Institution credential dashboard
- Issue and revoke credential interactions
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

The public demo uses `EDU-2026-00128` as the valid sample credential. Open `/dashboard` for the institution issuance and revocation workflow.

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

The browser flows use explicit demo data while the on-chain contract is production-shaped and tested. The next integration milestone connects the portal to the deployed registry, adds durable institutional records, generates real credential PDFs and QR codes, and connects OCR/AI document extraction.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system boundaries and data flow
- [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) — three-minute judging demonstration
- [BOT Chain developer quick guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/)
