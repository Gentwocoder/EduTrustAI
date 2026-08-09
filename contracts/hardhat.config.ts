import { configVariable, defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { fileURLToPath } from "node:url";

const localSolc = fileURLToPath(new URL("./node_modules/solc/soljson.js", import.meta.url));

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        path: localSolc,
        preferWasm: true,
        settings: {
          // BOT Chain currently requires bytecode compatible with the Paris EVM target.
          evmVersion: "paris",
          optimizer: { enabled: true, runs: 200 },
        },
      },
      production: {
        version: "0.8.28",
        path: localSolc,
        preferWasm: true,
        settings: {
          // Hardhat run uses the production profile, so this must be pinned separately.
          evmVersion: "paris",
          optimizer: { enabled: true, runs: 200 },
        },
      },
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
  verify: {
    etherscan: {
      // BOTScan ignores this value; Hardhat only requires it to be non-empty.
      apiKey: "blockscout",
    },
  },
  chainDescriptors: {
    968: {
      name: "BOT Chain Testnet",
      blockExplorers: {
        etherscan: {
          name: "BOTScan",
          url: "https://scan.bohr.life",
          apiUrl: "https://scan.bohr.life/api",
        },
      },
    },
  },
});
