import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = await deployer.getChainId();
  console.log("?? Deployer:", deployer.address);
  console.log("?? Network Chain ID:", chainId);

  // ���胍�W�b�N: �`�F�[�����
  const isMainnetOrSepolia = chainId === 1 || chainId === 11155111; // 1: Mainnet, 11155111: Sepolia
  const isPGirlsChain = chainId === 20250511;

  // ���ʁFBridge�f�v���C
  console.log("?? Deploying Bridge...");
  const Bridge = await ethers.getContractFactory("EIP712Bridge");
  const bridge = await Bridge.deploy();
  await bridge.deployed();
  console.log("? Bridge deployed at:", bridge.address);

  let token;

  if (isMainnetOrSepolia) {
    console.log("?? Target Network: Mainnet / Sepolia");

    // �_�~�[PGirls�g�[�N���𔭍s�imint/burn�p�r�j
    const Token = await ethers.getContractFactory("PGirlsToken");
    token = await Token.deploy("PGirlsToken", "PGIRLS");
    await token.deployed();
    console.log("?? Dummy PGirlsToken deployed at:", token.address);

    // �u���b�W�ɃI�[�i�[�V�b�v�ڏ�
    const tx = await token.transferOwnership(bridge.address);
    await tx.wait();
    console.log("?? Ownership transferred to Bridge:", bridge.address);
  }

  else if (isPGirlsChain) {
    console.log("?? Target Network: PGirlsChain");

    // PGirls�g�[�N�����s + ������������
    const initialSupply = ethers.utils.parseUnits("10000", 18);
    const Token = await ethers.getContractFactory("PGirlsToken");
    token = await Token.deploy("PGirlsToken", "PGIRLS");
    await token.deployed();
    console.log("?? PGirlsToken deployed at:", token.address);

    // ��������: �f�v���C���[�Ɉꎞ�I��mint �� �u���b�W�ڏ����mint�s��
    const mintTx = await token.mint(deployer.address, initialSupply);
    await mintTx.wait();
    console.log("?? Minted 10,000 PGirls to:", deployer.address);

    // �u���b�W�ɃI�[�i�[�V�b�v�ڏ�
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
