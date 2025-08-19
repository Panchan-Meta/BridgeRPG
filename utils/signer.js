import { Wallet } from "ethers";
import { createAxiosProvider } from "./provider";

export function getRelayerSigner() {
  const rpcUrl = process.env.PGIRLSCHAIN_RPC_URL;
  const chainId = Number(process.env.NEXT_PUBLIC_PGIRLS_CHAIN_ID);
  const privateKey = process.env.RELAYER_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error("Missing RPC URL or private key in environment");
  }

  const provider = createAxiosProvider(rpcUrl, chainId);
  return new Wallet(privateKey, provider);
}
