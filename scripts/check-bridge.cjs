const { ethers } = require("hardhat");

async function main() {
  const bridgeAddress = "0xb7E933304464b111C159900730BEd52C109e1cF8";
  const bridgeAbi = [
    "function bridgeToPGirls() payable",
    "function pgirlsToken() view returns (address)"
  ];

  const tokenAbi = [
    "function balanceOf(address) view returns (uint256)"
  ];

  const [signer] = await ethers.getSigners();
  const user = await signer.getAddress();

  const bridge = new ethers.Contract(bridgeAddress, bridgeAbi, signer);

  const tokenAddress = await bridge.pgirlsToken();
  const token = new ethers.Contract(tokenAddress, tokenAbi, signer);

  const pre = await token.balanceOf(user);
  console.log("?? Before:", ethers.utils.formatEther(pre));

  const tx = await bridge.bridgeToPGirls({
    value: ethers.utils.parseEther("0.0001"),
  });
  await tx.wait();

  const post = await token.balanceOf(user);
  console.log("?? After:", ethers.utils.formatEther(post));
  console.log("? TX Hash:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
