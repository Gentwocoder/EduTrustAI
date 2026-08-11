import { network } from "hardhat";

const { ethers, networkName } = await network.create();
const [deployer] = await ethers.getSigners();
const configuredNetworks = {
  botTestnet: {
    chainId: BigInt(968),
    explorer: "https://scan.bohr.life",
    label: "BOT Chain Testnet",
  },
  botMainnet: {
    chainId: BigInt(677),
    explorer: "https://scan.botchain.ai",
    label: "BOT Chain Mainnet",
  },
} as const;

if (!(networkName in configuredNetworks)) {
  throw new Error(`Deployment is restricted to BOT Chain networks. Received: ${networkName}`);
}

const selectedNetwork = configuredNetworks[networkName as keyof typeof configuredNetworks];
const connectedNetwork = await ethers.provider.getNetwork();
if (connectedNetwork.chainId !== selectedNetwork.chainId) {
  throw new Error(
    `Chain ID mismatch: expected ${selectedNetwork.chainId}, received ${connectedNetwork.chainId}.`,
  );
}

if (networkName === "botMainnet" && process.env.CONFIRM_MAINNET_DEPLOYMENT !== "yes") {
  throw new Error(
    "Mainnet deployment is locked. Set CONFIRM_MAINNET_DEPLOYMENT=yes only after a successful V2 testnet rehearsal.",
  );
}

const configuredRecovery = process.env.EDUTRUST_RECOVERY_ADMIN?.trim();
const recoveryAdmin = configuredRecovery || deployer.address;
if (!ethers.isAddress(recoveryAdmin)) {
  throw new Error("EDUTRUST_RECOVERY_ADMIN must be a complete EVM wallet or multisig address.");
}
if (
  networkName === "botMainnet" &&
  recoveryAdmin.toLowerCase() === deployer.address.toLowerCase()
) {
  throw new Error(
    "Mainnet V2 requires EDUTRUST_RECOVERY_ADMIN to be a separate, reviewed multisig address.",
  );
}

const deployerBalance = await ethers.provider.getBalance(deployer.address);
if (deployerBalance === BigInt(0)) {
  throw new Error(
    `Deployment wallet ${deployer.address} has no BOT available for gas on ${selectedNetwork.label}.`,
  );
}

console.log(`Network: ${selectedNetwork.label} (${connectedNetwork.chainId})`);
console.log(`Initial administrator: ${deployer.address}`);
console.log(`Recovery administrator: ${recoveryAdmin}`);
console.log(`Balance: ${ethers.formatEther(deployerBalance)} BOT`);
console.log("Deploying EduTrustRegistryV2...");

const registry = await ethers.deployContract("EduTrustRegistryV2", [
  deployer.address,
  recoveryAdmin,
]);
const deploymentTransaction = registry.deploymentTransaction();
await registry.waitForDeployment();

const contractAddress = await registry.getAddress();
console.log(`EduTrustRegistryV2 address: ${contractAddress}`);
console.log(`Contract explorer: ${selectedNetwork.explorer}/address/${contractAddress}`);

if (deploymentTransaction) {
  console.log(`Deployment transaction: ${deploymentTransaction.hash}`);
  console.log(`Transaction explorer: ${selectedNetwork.explorer}/tx/${deploymentTransaction.hash}`);
}
