const { ethers } = require("ethers");

async function main() {
  const privateKey = "0x" + process.env.RELAYER_PRIVATE_KEY; // .env‚©‚çŽæ“¾
  const wallet = new ethers.Wallet(privateKey);

  const domain = {
    name: "PGirlsBridge",
    version: "1",
    chainId: 20250511,
    verifyingContract: "0x6D544c81dd8fC4E352b564a1bA814d371C5b89B2"
  };

  const types = {
    Bridge: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" }
    ]
  };

  const message = {
    user: "0x906937D6C571ef58b454D111228290348C31d936",
    amount: ethers.BigNumber.from("25000000000000000000"),
    nonce: 0
  };

  const signature = await wallet._signTypedData(domain, types, message);

  console.log("? Signature:", signature);
}

main();