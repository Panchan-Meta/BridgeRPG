const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0xd8B2D66EE3187dc872ac24Cca6887b9d4cF7C652";
  const bridgeAddress = "0x35Ea005208c993974AC66FE4EF83E7EDC00668D8";

  const tokenAbi = [
    "function grantRole(bytes32 role, address account) external",
    "function hasRole(bytes32 role, address account) view returns (bool)"
  ];

  const [admin] = await ethers.getSigners();
  const token = new ethers.Contract(tokenAddress, tokenAbi, admin);

  const MINTER_ROLE = ethers.utils.id("MINTER_ROLE");

  const tx = await token.grantRole(MINTER_ROLE, bridgeAddress);
  await tx.wait();

  const hasRole = await token.hasRole(MINTER_ROLE, bridgeAddress);
  console.log("? Granted MINTER_ROLE to bridge:", hasRole);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
