require("dotenv").config();
const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();

  const rawPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!rawPrivateKey) {
    throw new Error("❌ RELAYER_PRIVATE_KEY is missing in .env");
  }

  const relayerWallet = new ethers.Wallet(rawPrivateKey);
  const relayerAddress = relayerWallet.address;

  console.log(`🌐 Network: ${networkName}`);
  console.log(`👤 Deployer: ${deployer?.address}`);
  console.log(`🔁 Relayer Address (from PRIVATE_KEY): ${relayerAddress}`);

  const deployed = {
    network: networkName,
    deployer: deployer.address,
    relayer: relayerAddress,
    contracts: {},
  };

  if (networkName === "mainnet") {
    console.log("===== 🏗️ Deploying PGirlsTokenStub & EIP712Bridge to MAINNET =====");

    // STEP 1: PGirlsTokenStub デプロイ
    console.log("🚀 Deploying PGirlsTokenStub...");
    const PGirlsTokenStub = await ethers.getContractFactory("contracts/PGirlsTokenStub.sol:PGirlsTokenStub");
    const pgirlsToken = await PGirlsTokenStub.deploy();
    await pgirlsToken.deployed();

    const pgirlsTokenAddress = pgirlsToken.address?.trim();
    if (!pgirlsTokenAddress || !ethers.utils.isAddress(pgirlsTokenAddress)) {
      throw new Error(`❌ Invalid pgirlsToken.address: "${pgirlsTokenAddress}"`);
    }
    console.log("✅ PGirlsTokenStub Deployed at:", pgirlsTokenAddress);

    // STEP 2: Bridge デプロイ
    console.log("🔗 Deploying EIP712Bridge...");
    const BridgeFactory = await ethers.getContractFactory("contracts/EIP712Bridge.sol:EIP712Bridge");
    const bridge = await BridgeFactory.deploy(pgirlsTokenAddress, relayerAddress, {
      gasLimit: 3_000_000,
      gasPrice: ethers.utils.parseUnits("20", "gwei"),
    });
    await bridge.deployed();

    console.log("✅ EIP712Bridge Deployed at:", bridge.address);

    deployed.contracts.PGirlsTokenStub = pgirlsTokenAddress;
    deployed.contracts.Bridge = bridge.address;
  }

  else if (networkName === "pgirls") {
    console.log("===== 🏗️ Deploying PGirlsToken & EIP712Bridge to PGirlsChain =====");

    const initialSupply = ethers.utils.parseUnits("1000000", 18);
    const PGirlsToken = await ethers.getContractFactory("contracts/PGirlsToken.sol:PGirlsToken");
    const pgirlsToken = await PGirlsToken.deploy(initialSupply, deployer.address);
    await pgirlsToken.deployed();

    const pgirlsTokenAddress = pgirlsToken.address?.trim();
    if (!pgirlsTokenAddress || !ethers.utils.isAddress(pgirlsTokenAddress)) {
      throw new Error(`❌ Invalid pgirlsToken.address: "${pgirlsTokenAddress}"`);
    }
    console.log("✅ PGirlsToken Deployed at:", pgirlsTokenAddress);

    const BridgeFactory = await ethers.getContractFactory("contracts/EIP712Bridge.sol:EIP712Bridge");
    const bridge = await BridgeFactory.deploy(pgirlsTokenAddress, relayerAddress, {
      gasLimit: 3_000_000,
      gasPrice: ethers.utils.parseUnits("20", "gwei"),
    });
    await bridge.deployed();

    console.log("✅ EIP712Bridge Deployed at:", bridge.address);

    deployed.contracts.PGirlsToken = pgirlsTokenAddress;
    deployed.contracts.Bridge = bridge.address;
  }

  else {
    throw new Error(`❌ Unsupported network: "${networkName}"`);
  }

  const outDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const outPath = path.join(outDir, `${networkName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log(`📦 Deployment info saved to: ${outPath}`);
}

main().catch((err) => {
  console.error("❌ Deployment error:", err);
  process.exit(1);
});
