import { providers } from "ethers";
import axios from "axios";

export function createAxiosProvider(rpcUrl, chainId) {
  const provider = new providers.JsonRpcProvider(rpcUrl, chainId);

  provider.send = async (method, params) => {
    const response = await axios.post(rpcUrl, {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    });
    if (response.data.error) throw new Error(response.data.error.message);
    return response.data.result;
  };

  return provider;
}
