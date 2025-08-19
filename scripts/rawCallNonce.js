const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const RPC_URL = process.env.NEXT_PUBLIC_PGIRLSCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  const bridgeAddress = "0xa56001EE851f40eFbA4a1F94EB9566541783A3F5";
  const user = "0x906937D6C571ef58b454D111228290348C31d936";

  // nonces(address) selector + address (padded)
  const iface = new ethers.utils.Interface([
    "function nonces(address) view returns (uint256)"
  ]);
  const data = iface.encodeFunctionData("nonces", [user]);

  try {
    const result = await provider.call({
      to: bridgeAddress,
      data: data,
    });

    const decoded = iface.decodeFunctionResult("nonces", result);
    console.log("? nonces():", decoded[0].toString());
  } catch (err) {
    console.error("? eth_call failed:", err);
  }
}

main();
