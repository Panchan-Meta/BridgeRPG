// scripts/withdrawAllETH.cjs

const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const bridgeAddress = "0x8955e07359D8F24ed30Dba3e647a4155854d6217";
  const recipient = "0x2EC680be1B17DE7B0FFBE3a5E3aED9dDbF65ec44";

  const abi = ["function withdrawAllETH(address to) external"];

 const provider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL);

  const privateKey = process.env.OWNER_PRIVATE_KEY; // .envに設定しておくと安全
  if (!privateKey) {
    throw new Error("? OWNER_PRIVATE_KEY is not set in .env");
  }

  const signer = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(bridgeAddress, abi, signer);

  console.log(`? Attempting to withdraw all ETH to: ${recipient}`);
  const tx = await contract.withdrawAllETH(recipient, {
    gasLimit: 100_000, // fallbackで指定（必要なら増やす）
  });

  console.log(`?? Tx sent: ${tx.hash}`);
  await tx.wait();
  console.log("? ETH withdrawn successfully.");
}

main().catch((err) => {
  console.error("? Error:", err.message || err);
  process.exit(1);
});
