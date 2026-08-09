# EduTrust AI contracts

`EduTrustRegistry` stores only credential identifiers and document fingerprints. Student names, grades and files remain off-chain.

## BOT Chain networks

| Network | Chain ID | RPC | Explorer |
| --- | ---: | --- | --- |
| Testnet | 968 | `https://rpc.bohr.life` | `https://scan.bohr.life` |
| Mainnet | 677 | `https://rpc.botchain.ai` | `https://scan.botchain.ai` |

## Local validation

```bash
npm install
npm test
```

## Deployment

Store `BOT_PRIVATE_KEY` in Hardhat's encrypted keystore or your local environment. Do not add it to any committed file.

```bash
npm run deploy:testnet
npm run deploy:mainnet
```

Mainnet deployment requires BOT for gas. The public issuer wallet supplied for the project is `0xAc7052141497866a8e3048B5Bb7a30c6418b5567`.
