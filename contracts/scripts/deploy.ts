import { network } from "hardhat";

const { ethers, networkName } = await network.create();
const [deployer] = await ethers.getSigners();

console.log(`Deploying EduTrustRegistry to ${networkName} from ${deployer.address}...`);

const registry = await ethers.deployContract("EduTrustRegistry", [deployer.address]);
await registry.waitForDeployment();

console.log("EduTrustRegistry address:", await registry.getAddress());
