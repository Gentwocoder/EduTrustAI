import { configVariable, defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { fileURLToPath } from "node:url";

const localSolc = fileURLToPath(new URL("./node_modules/solc/soljson.js", import.meta.url));

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
    path: localSolc,
    preferWasm: true,
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    botTestnet: {
      type: "http",
      chainType: "l1",
      chainId: 968,
      url: "https://rpc.bohr.life",
      accounts: [configVariable("BOT_PRIVATE_KEY")],
    },
    botMainnet: {
      type: "http",
      chainType: "l1",
      chainId: 677,
      url: "https://rpc.botchain.ai",
      accounts: [configVariable("BOT_PRIVATE_KEY")],
    },
  },
});
