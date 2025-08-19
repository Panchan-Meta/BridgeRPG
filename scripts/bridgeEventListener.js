// bridgeEventListener.js
import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

// ✅ 環境変数から読み込み
const RPC_URL = process.env.NEXT_PUBLIC_PGIRLSCHAIN_RPC_URL;
const BRIDGE_ADDRESS = process.env.NEXT_PUBLIC_PGIRLS_BRIDGE_CONTRACT_ADDRESS;

if (!RPC_URL || !BRIDGE_ADDRESS) {
  console.error("❌ Missing environment variables: RPC_URL or BRIDGE_ADDRESS");
  process.exit(1);
}

// ✅ イベント定義（必要なものだけ）
const ABI = [
  "event DebugString(string message)",
  "event DebugUint(string label, uint256 value)",
  "event MintCalled(address indexed caller, address indexed user, uint256 amount)",
  "event MintSuccess(address indexed user, uint256 amount)",
  "event MintFailed(string reason)",
  "event BridgeMinted(address indexed user, uint256 amount, string direction)",
  "event BridgeBurned(address indexed from, uint256 amount, string direction)",
  "event Burned(address indexed user, uint256 tokenAmount, uint256 ethAmount)"
];

async function main() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const bridge = new ethers.Contract(BRIDGE_ADDRESS, ABI, provider);

    console.log("🔍 Listening to Bridge Contract Events...");

    bridge.on("DebugString", (message) => {
      console.log(`🪵 DebugString: ${message}`);
    });

    bridge.on("DebugUint", (label, value) => {
      console.log(`📊 DebugUint [${label}]: ${value.toString()}`);
    });

    bridge.on("MintCalled", (caller, user, amount) => {
      console.log(`📤 MintCalled: caller=${caller}, user=${user}, amount=${ethers.utils.formatEther(amount)} PGirls`);
    });

    bridge.on("MintSuccess", (user, amount) => {
      console.log(`✅ MintSuccess: user=${user}, amount=${ethers.utils.formatEther(amount)} PGirls`);
    });

    bridge.on("MintFailed", (reason) => {
      console.log(`❌ MintFailed: ${reason}`);
    });

    bridge.on("BridgeMinted", (user, amount, direction) => {
      console.log(`🎉 BridgeMinted: user=${user}, amount=${ethers.utils.formatEther(amount)} (${direction})`);
    });

    bridge.on("BridgeBurned", (from, amount, direction) => {
      console.log(`🔥 BridgeBurned: from=${from}, amount=${ethers.utils.formatEther(amount)} (${direction})`);
    });

    bridge.on("Burned", (user, tokenAmount, ethAmount) => {
      console.log(`💸 Burned: user=${user}, PGirls=${ethers.utils.formatEther(tokenAmount)}, ETH=${ethers.utils.formatEther(ethAmount)}`);
    });

  } catch (err) {
    console.error("💥 bridgeEventListener error:", err);
    process.exit(1);
  }
}

main();
