# EduTrust AI contracts

`EduTrustRegistry` stores only credential identifiers and document fingerprints. Student names, grades and files remain off-chain.

## BOT Chain networks

| Network | Chain ID | RPC | Explorer |
| --- | ---: | --- | --- |
| Testnet | 968 | `https://rpc.bohr.life` | `https://scan.bohr.life` |
| Mainnet | 677 | `https://rpc.botchain.ai` | `https://scan.botchain.ai` |

## Local validation

```bash
npm ci
npm run compile
npm test
```

## Testnet deployment

Deploy to Testnet before using Mainnet. Testnet BOT has no monetary value and is available from the official faucet.

### 1. Add BOT Chain Testnet to the deployment wallet

| Item | Value |
| --- | --- |
| Network name | BOT Chain Testnet |
| RPC URL | `https://rpc.bohr.life` |
| Chain ID | `968` |
| Currency symbol | `BOT` |
| Explorer | `https://scan.bohr.life` |

### 2. Fund the wallet

Use the [BOT Chain faucet](https://faucet.botchain.ai) to send test BOT to the deployment wallet. The intended project wallet is `0xAc7052141497866a8e3048B5Bb7a30c6418b5567`.

Confirm the wallet has a positive test BOT balance before continuing.

### 3. Store the signer securely

Install the locked dependencies, then store the private key in Hardhat's encrypted keystore:

```bash
npm ci
npx hardhat keystore set BOT_PRIVATE_KEY
```

Hardhat prompts for a keystore password and then the private key. Never paste a private key into chat, source code, shell history, an `.env` file committed to Git, or a GitHub secret that is exposed to untrusted workflows.

The private key must belong to the funded deployment wallet. The deployment script prints the derived public address so it can be checked before the transaction is broadcast.

### 4. Validate and deploy

```bash
npm run compile
npm test
npm run deploy:testnet
```

The deployment script checks all of the following before broadcasting:

- The selected network is a configured BOT Chain network
- The connected chain ID is `968`
- The signer has test BOT for gas
- The deployed wallet becomes the initial administrator and issuer

Successful output includes the contract address, deployment transaction hash and BOT Testnet explorer links. Keep those public values for frontend integration.

## Mainnet deployment

Mainnet deployment remains locked until it is explicitly confirmed after a successful Testnet rehearsal:

```bash
CONFIRM_MAINNET_DEPLOYMENT=yes npm run deploy:mainnet
```

Mainnet deployment requires real BOT for gas. Review the contract address, transaction and roles on the explorer immediately after deployment.

## Secret handling

Store `BOT_PRIVATE_KEY` in Hardhat's encrypted keystore. Do not add it to any committed file.

The repository contains only the public project wallet address. It does not contain and must never contain a private key or seed phrase.

Mainnet deployment requires BOT for gas. The public issuer wallet supplied for the project is `0xAc7052141497866a8e3048B5Bb7a30c6418b5567`.
