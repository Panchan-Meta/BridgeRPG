import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = await deployer.getChainId();
  console.log("?? Deployer:", deployer.address);
  console.log("?? Network Chain ID:", chainId);

  // 決定ロジック: チェーン種別
  const isMainnetOrSepolia = chainId === 1 || chainId === 11155111; // 1: Mainnet, 11155111: Sepolia
  const isPGirlsChain = chainId === 20250511;

  // 共通：Bridgeデプロイ
  console.log("?? Deploying Bridge...");
  const Bridge = await ethers.getContractFactory("EIP712Bridge");
  const bridge = await Bridge.deploy();
  await bridge.deployed();
  console.log("? Bridge deployed at:", bridge.address);

  let token;

  if (isMainnetOrSepolia) {
    console.log("?? Target Network: Mainnet / Sepolia");

    // ダミーPGirlsトークンを発行（mint/burn用途）
    const Token = await ethers.getContractFactory("PGirlsToken");
    token = await Token.deploy("PGirlsToken", "PGIRLS");
    await token.deployed();
    console.log("?? Dummy PGirlsToken deployed at:", token.address);

    // ブリッジにオーナーシップ移譲
    const tx = await token.transferOwnership(bridge.address);
    await tx.wait();
    console.log("?? Ownership transferred to Bridge:", bridge.address);
  }

  else if (isPGirlsChain) {
    console.log("?? Target Network: PGirlsChain");

    // PGirlsトークン発行 + 初期供給あり
    const initialSupply = ethers.utils.parseUnits("10000", 18);
    const Token = await ethers.getContractFactory("PGirlsToken");
    token = await Token.deploy("PGirlsToken", "PGIRLS");
    await token.deployed();
    console.log("?? PGirlsToken deployed at:", token.address);

    // 初期供給: デプロイヤーに一時的にmint → ブリッジ移譲後はmint不可
    const mintTx = await token.mint(deployer.address, initialSupply);
    await mintTx.wait();
    console.log("?? Minted 10,000 PGirls to:", deployer.address);

    // ブリッジにオーナーシップ移譲
    const tx = await token.transferOwnership(bridge.address);
    await tx.wait();
    console.log("?? Ownership transferred to Bridge:", bridge.address);
  }

  else {
    throw new Error(`? Unknown network chainId: ${chainId}`);
  }

  console.log("\n? Deployment Summary:");
  console.log("Bridge Address:", bridge.address);
  console.log("Token Address :", token.address);
}

main().catch((error) => {
  console.error("? Deployment failed:", error);
  process.exitCode = 1;
});
