const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x739EE2dCD86278EB8dE76E08De951081139E1B76"; // PGirls token

  const userAddress = "0x906937D6C571ef58b454D111228290348C31d936"; // ? ← MetaMaskで表示されたアドレスに置き換えてください

  const tokenAbi = [
    "function balanceOf(address) view returns (uint256)"
  ];

  const provider = new ethers.providers.JsonRpcProvider("https://rpc.rahabpunkaholicgirls.com");
  const token = new ethers.Contract(tokenAddress, tokenAbi, provider);

  const balance = await token.balanceOf(userAddress);
  console.log("? PGirls Balance:", ethers.utils.formatEther(balance));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
