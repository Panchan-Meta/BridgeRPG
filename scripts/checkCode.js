const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const RPC_URL = process.env.NEXT_PUBLIC_PGIRLSCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const bridgeAddress = "0x57251521C29E3fa2F142030aCf93485eEAe72856"; // ← チェック対象のアドレス

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const code = await provider.getCode(bridgeAddress);

  console.log(`? Code length at ${bridgeAddress}:`, code.length);
  console.log(`?? Code (truncated):`, code.slice(0, 20), "...");

  if (code === "0x") {
    console.log("? No contract code found ? this address has no deployed contract.");
  } else {
    console.log("? Contract exists at this address.");
  }
}

main().catch(console.error);
