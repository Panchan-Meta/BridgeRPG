import { ethers } from "ethers";

const domain = {
  name: "PGirlsBridge",
  version: "1",
  chainId: 20250511,
  verifyingContract: "0x6E099835c841f2D7Af4855Db45493D29E0d82a7d",
};

const types = {
  Bridge: [
    { name: "user", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

const value = {
  user: "0x906937D6C571ef58b454D111228290348C31d936",
  amount: ethers.BigNumber.from("55555555555555559"), // Å© óvàÍívÅI
  nonce: 0,
};

const signature =
  "0xb1d7d6c17f44724d0ea24748dd2a78675697344ac6414b39f292d022a5dabf5c6fcdd6692882500791614a033d3af82644faed945d420674235fe2f6080e8fb31c";

const digest = ethers.utils._TypedDataEncoder.hash(domain, types, value);
const recovered = ethers.utils.recoverAddress(digest, signature);

console.log("Digest:    ", digest);
console.log("Recovered: ", recovered);
