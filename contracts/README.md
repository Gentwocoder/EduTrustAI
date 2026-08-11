# EduTrust AI contracts

EduTrust contracts store credential identifiers, document fingerprints, lifecycle state, timestamps, and authorised wallet addresses. Student names, grades, contact details, and source files remain off-chain.

## Contract versions

| Contract | State | Capabilities |
| --- | --- | --- |
| `EduTrustRegistry` | Deployed V1 | Permissioned issuance, revocation, fingerprint verification, issuer role management |
| `EduTrustRegistryV2` | Deployment-ready | V1-compatible reads plus expiry, renewal, correction, replacement links, and recoverable administration |

V1 is immutable and non-upgradeable. V2 must be deployed as a separate contract. The frontend detects `contractVersion()`; existing V1 credentials remain readable at their original registry address.

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

Both Hardhat build profiles are pinned to Solidity `0.8.28` and the `paris` EVM target required by BOT Chain. After compiler or target changes:

```bash
npx hardhat clean
npm run compile
npx hardhat --build-profile production compile --force
```

## Secure signer configuration

Store the funded deployment key in Hardhat's encrypted keystore:

```bash
npx hardhat keystore set BOT_PRIVATE_KEY
```

Never place the private key or seed phrase in source code, committed environment files, chat, screenshots, or shell history. The intended public project wallet is `0xAc7052141497866a8e3048B5Bb7a30c6418b5567`.

## V1 deployment

Testnet:

```bash
npm run deploy:testnet
```

Mainnet, only after a successful Testnet rehearsal:

```bash
CONFIRM_MAINNET_DEPLOYMENT=yes npm run deploy:mainnet
```

The V1 constructor accepts the initial administrator wallet and grants it both `DEFAULT_ADMIN_ROLE` and `ISSUER_ROLE`.

## V2 deployment

V2 accepts two constructor arguments:

1. the initial primary administrator; and
2. a recovery administrator, preferably a reviewed Safe or other EVM multisig.

For Testnet, `EDUTRUST_RECOVERY_ADMIN` defaults to the deployer when omitted so the workflow can be rehearsed. Use a separate Testnet multisig when testing the complete recovery path.

```bash
EDUTRUST_RECOVERY_ADMIN=0x... npm run deploy:v2:testnet
```

Mainnet refuses deployment unless the recovery address is configured and differs from the deployer:

```bash
EDUTRUST_RECOVERY_ADMIN=0x... \
CONFIRM_MAINNET_DEPLOYMENT=yes \
npm run deploy:v2:mainnet
```

After deployment, configure the frontend with the applicable address:

```bash
NEXT_PUBLIC_EDUTRUST_TESTNET_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_EDUTRUST_MAINNET_REGISTRY_ADDRESS=0x...
```

Each network can be activated independently. Until an address is changed, that network continues using the deployed V1 registry.

## V2 lifecycle model

- An optional `expiresAt` timestamp makes a valid credential resolve as `Expired` after the deadline.
- `renewCredential` and `correctCredential` create a new record and mark the original `Replaced`.
- The original and replacement hashes link to each other, preserving the audit trail.
- Only the original issuer or registry administrator can replace an active credential, and the caller must retain `ISSUER_ROLE`.
- Revocation remains a misconduct/withdrawal lifecycle action and is not used for routine renewal or correction.

## Administrator recovery and multisig

`RECOVERY_ROLE` should be granted to an external multisig. The recovery wallet can propose a new primary administrator; the proposed address must accept. Acceptance grants administrator and issuer roles to the new wallet and removes both roles from the previous primary administrator.

The contract does not implement its own signer threshold. Multisig policy, hardware-wallet requirements, and approver rotation belong in a reviewed EVM multisig such as Safe.

## BOTScan verification

V1 constructor:

```bash
npx hardhat verify etherscan --network botTestnet \
  <CONTRACT_ADDRESS> <INITIAL_ADMIN_ADDRESS>
```

V2 constructor:

```bash
npx hardhat verify etherscan --network botTestnet \
  <CONTRACT_ADDRESS> <INITIAL_ADMIN_ADDRESS> <RECOVERY_ADMIN_ADDRESS>
```

Replace `botTestnet` with `botMainnet` for Mainnet verification.
