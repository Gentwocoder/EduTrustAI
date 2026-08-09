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
    "Mainnet deployment is locked. Set CONFIRM_MAINNET_DEPLOYMENT=yes only after a successful testnet rehearsal.",
  );
}

const deployerBalance = await ethers.provider.getBalance(deployer.address);
if (deployerBalance === BigInt(0)) {
  throw new Error(
    `Deployment wallet ${deployer.address} has no BOT available for gas on ${selectedNetwork.label}.`,
  );
}

console.log(`Network: ${selectedNetwork.label} (${connectedNetwork.chainId})`);
console.log(`Deployer: ${deployer.address}`);
console.log(`Balance: ${ethers.formatEther(deployerBalance)} BOT`);
console.log("Deploying EduTrustRegistry...");

const registry = await ethers.deployContract("EduTrustRegistry", [deployer.address]);
const deploymentTransaction = registry.deploymentTransaction();
await registry.waitForDeployment();

const contractAddress = await registry.getAddress();
console.log(`EduTrustRegistry address: ${contractAddress}`);
console.log(`Contract explorer: ${selectedNetwork.explorer}/address/${contractAddress}`);

if (deploymentTransaction) {
  console.log(`Deployment transaction: ${deploymentTransaction.hash}`);
  console.log(`Transaction explorer: ${selectedNetwork.explorer}/tx/${deploymentTransaction.hash}`);
}
