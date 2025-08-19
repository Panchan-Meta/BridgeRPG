require("dotenv").config();

const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`? Network: ${network.name}`);
  console.log(`? Deployer: ${deployer.address}`);

  const initialSupply = ethers.utils.parseUnits("1000000", 18);
  const PGirlsToken = await ethers.getContractFactory("PGirlsToken");

  const recipient = process.env.NEXT_PUBLIC_OWNER_ADDRESS || deployer.address;

  if (!recipient || !ethers.utils.isAddress(recipient)) {
    throw new Error("? Invalid recipient address");
  }

	let token;
	try {
	  token = await PGirlsToken.deploy(initialSupply, recipient);
	  await token.deployed();
	  console.log(`✅ PGirlsToken deployed at: ${token.address}`);
	} catch (err) {
	  console.error("❌ PGirlsToken deployment failed:", err);
	  process.exit(1);
	}

  const bridgeAddress = process.env.PGIRLS_BRIDGE_CONTRACT_ADDRESS;
  if (!bridgeAddress || !ethers.utils.isAddress(bridgeAddress)) {
    throw new Error("? Invalid bridge address in .env");
  }

  try {
    const tx = await token.setMinter(bridgeAddress, true);
    await tx.wait();
    console.log(`? Minter registered: ${bridgeAddress}`);
  } catch (err) {
    console.error("?? Failed to set minter. Continuing...", err.message);
  }
}

main().catch((err) => {
  console.error("? Deployment failed:", err);
  process.exit(1);
});
