const { ethers } = require("hardhat");

async function main() {
  const bridgeAddr = "0x57251521C29E3fa2F142030aCf93485eEAe72856";
  const bridge = await ethers.getContractAt("EIP712Bridge", bridgeAddr);
  const user = "0x906937D6C571ef58b454D111228290348C31d936";
  const nonce = await bridge.nonces(user);
  console.log(`? Nonce for user ${user}:`, nonce.toString());
}

main();
