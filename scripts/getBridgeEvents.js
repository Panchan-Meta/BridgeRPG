// scripts/getBridgeEvents.js
require("dotenv").config();
const { ethers } = require("ethers");

const ABI = [
  "event DebugString(string message)",
  "event DebugUint(string label, uint256 value)",
  "event MintCalled(address indexed caller, address indexed user, uint256 amount)",
  "event MintSuccess(address indexed user, uint256 amount)",
  "event MintFailed(string reason)",
  "event BridgeMinted(address indexed user, uint256 amount, string direction)",
  "event BridgeBurned(address indexed from, uint256 amount, string direction)",
];

const provider = new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_PGIRLSCHAIN_RPC_URL);
const contract = new ethers.Contract(process.env.PGIRLS_BRIDGE_CONTRACT_ADDRESS, ABI, provider);

async function fetchAllEvents() {
  console.log("?? Fetching all events from contract:", contract.address);
  const fromBlock = 0;
  const toBlock = "latest";

  for (const abiItem of ABI) {
    const eventName = abiItem.match(/event (\w+)/)[1];
    const logs = await contract.queryFilter(eventName, fromBlock, toBlock);

    console.log(`\n?? ${eventName} Events (${logs.length} total)`);
    for (const log of logs) {
      console.log("Block:", log.blockNumber);
      console.log("TxHash:", log.transactionHash);
      console.log("Args:", log.args);
      console.log("---");
    }
  }
}

fetchAllEvents().catch(console.error);
