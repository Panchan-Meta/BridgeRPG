import { ethers } from "ethers";

export async function signTypedData(signer, user, nonce, amount, verifyingContract, chainId = 20250511) {
  const domain = {
    name: "Bridge",
    version: "1",
    chainId,
    verifyingContract,
  };

  const types = {
    Bridge: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  };

  const value = {
    user,
    amount: ethers.utils.parseEther(amount.toString()).toString(),
    nonce,
  };

  return await signer._signTypedData(domain, types, value);
}
