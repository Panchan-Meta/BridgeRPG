// hardhat.config.cjs
require("dotenv/config");
if (!process.env.HARDHAT_SKIP_LOAD) {
  require("@nomiclabs/hardhat-ethers");
  require("@nomicfoundation/hardhat-verify");
}
// ---- helpers ----
function sanitizePk(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(/^['"]|['"]$/g, ""); // 引用符除去
  const hex = s.startsWith("0x") ? s.slice(2) : s;
  return /^[0-9a-fA-F]{64}$/.test(hex) ? ("0x" + hex) : null;
}
const PK = sanitizePk(process.env.DEPLOYER_PRIVATE_KEY);

function net(url, chainId) {
  if (!url) return undefined;                 // URL未設定ならネットワーク自体を作らない
  const cfg = { url, chainId };
  if (PK) cfg.accounts = [PK];                // 鍵が正しい時だけ accounts を付ける
  return cfg;
}

const networks = {
  mainnet: net(process.env.ETH_RPC_URL, 1),
  ...(process.env.SEPOLIA_RPC_URL ? { sepolia: net(process.env.SEPOLIA_RPC_URL, 11155111) } : {}),
  ...(process.env.PGIRLSCHAIN_RPC_URL
    ? { pgirls: net(process.env.PGIRLSCHAIN_RPC_URL, Number(process.env.PGIRLSCHAIN_CHAIN_ID || 20250511)) }
    : {}),
};
// undefined を掃除
for (const k of Object.keys(networks)) if (!networks[k]) delete networks[k];

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks,
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || "" },
};
