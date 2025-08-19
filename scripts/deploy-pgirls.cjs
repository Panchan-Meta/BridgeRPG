const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();

  const deployed = {
    network: network.name,
    deployer: deployer.address,
    contracts: {},
  };

  console.log(`🚀 Network: ${network.name}`);
  console.log(`👤 Deployer: ${deployer.address}`);

  // ✅ 1. Bridge を先にデプロイ（PGirlsToken のオーナーになるため）
  const Bridge = await ethers.getContractFactory("EIP712Bridge");
  const bridge = await Bridge.deploy(); // constructor に PGirlsToken 渡さない構成にする
  await bridge.deployed();
  console.log("🔗 EIP712Bridge deployed at:", bridge.address);

  // ✅ 2. PGirlsToken をデプロイ（初期供給 + 所有者 = deployer）
  const PGirlsToken = await ethers.getContractFactory("PGirlsToken");
  const initialSupply = ethers.utils.parseUnits("10000", 18);
  const pgirls = await PGirlsToken.deploy(initialSupply, deployer.address);
  await pgirls.deployed();
  console.log("🎀 PGirlsToken deployed at:", pgirls.address);

  // ✅ 3. オーナーシップをBridgeに移譲
  try {
    const tx1 = await pgirls.transferOwnership(bridge.address);
    await tx1.wait();
    console.log("🔐 Ownership of PGirlsToken transferred to Bridge");
  } catch (err) {
    console.warn("⚠️ transferOwnership failed:", err.message);
  }

  // ✅ 4. Bridge に PGirlsToken のアドレスを設定（setPGirlsToken）
  try {
    const setTokenTx = await bridge.setPGirlsToken(pgirls.address);
    await setTokenTx.wait();
    console.log("🛠 Bridge linked to PGirlsToken");
  } catch (err) {
    console.warn("⚠️ setPGirlsToken failed:", err.message);
  }

  // ✅ 5. Bridge から自身にミンター権限を付与（Bridgeがownerのため実行可能）
  try {
    const grantMinterTx = await bridge.setSelfAsMinter();
    await grantMinterTx.wait();
    console.log("✅ Bridge set itself as minter");
  } catch (err) {
    console.warn("⚠️ Bridge self-minter assignment failed:", err.message);
  }

  // ✅ 保存
  deployed.contracts.Bridge = bridge.address;
  deployed.contracts.PGirlsToken = pgirls.address;

  const outDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const outPath = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log(`📦 Deployment info saved to: ${outPath}`);
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
