// scripts/deploy-bridge-mainnet.cjs
require("dotenv").config();
const { ethers, run } = require("hardhat");

// ==== Hotfix: some RPCs return "" instead of null for contract-creation tx ====
(function patchEthersFormatter() {
  try {
    const F = ethers.providers.Formatter && ethers.providers.Formatter.prototype;
    if (!F) return;

    const wrap = (fnName) => {
      const orig = F[fnName];
      if (typeof orig !== "function") return;
      F[fnName] = function (value) {
        if (value && typeof value === "object") {
          if (value.to === "") value.to = null;
          if (value.from === "") value.from = null;
          if (value.contractAddress === "") value.contractAddress = null;
        }
        return orig.call(this, value);
      };
    };

    wrap("transactionResponse"); // 送信直後のTxレスポンス
    wrap("receipt");             // マイニング後のレシート
  } catch (_) {}
})();
// ============================================================================

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitForCode(provider, address, { timeoutMs = 180000, intervalMs = 3000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const code = await provider.getCode(address);
    if (code && code !== "0x") return true;
    await sleep(intervalMs);
  }
  return false;
}

async function main() {
  console.log("== Deploying EIP712Bridge to Ethereum mainnet ==");

  const net = await ethers.provider.getNetwork();
  console.log("RPC network:", net.chainId, net.name);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer: check DEPLOYER_PRIVATE_KEY in .env");
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  // 1) Deploy（receipt 依存を避ける）
  const nonceBefore = await ethers.provider.getTransactionCount(deployerAddr);
  const predictedAddr = ethers.utils.getContractAddress({ from: deployerAddr, nonce: nonceBefore });
  console.log("Predicted contract address:", predictedAddr);

  const Factory = await ethers.getContractFactory("EIP712Bridge");
  const bridge = await Factory.deploy(); // ここでRPCが to:"" を返しても上のパッチで吸収
  console.log("Deploy tx:", bridge.deployTransaction.hash);

  // getCode で確定を待つ
  const ok = await waitForCode(ethers.provider, predictedAddr);
  if (!ok) console.warn("Timed out waiting for code at predicted address…続行します。");
  const bridgeAddress = predictedAddr;
  console.log("Bridge deployed at:", bridgeAddress);

  // 以降は attach して操作
  const bridgeAttached = await ethers.getContractAt("EIP712Bridge", bridgeAddress);

  // 2) Post setup
  const tasks = [];

  const tokenAddr = (process.env.PGIRLS_TOKEN || "").trim();
  if (tokenAddr) {
    if (!ethers.utils.isAddress(tokenAddr)) {
      console.warn("PGIRLS_TOKEN is not a valid address. Skipped setPGirlsToken.");
    } else {
      console.log("Calling setPGirlsToken:", tokenAddr);
      tasks.push(bridgeAttached.setPGirlsToken(tokenAddr).then(tx => tx.wait()));
    }
  }

  const rateNum = (process.env.RATE_NUMERATOR || "").trim();
  const rateDen = (process.env.RATE_DENOMINATOR || "").trim();
  if (rateNum && rateDen) {
    const numBN = ethers.BigNumber.from(rateNum);
    const denBN = ethers.BigNumber.from(rateDen);
    console.log(`Calling setRate(${numBN.toString()}, ${denBN.toString()})`);
    tasks.push(bridgeAttached.setRate(numBN, denBN).then(tx => tx.wait()));
  }

  if (tokenAddr && ethers.utils.isAddress(tokenAddr)) {
    console.log("Calling setSelfAsMinter()");
    tasks.push(
      bridgeAttached.setSelfAsMinter().then(tx => tx.wait()).catch(() => {
        console.log("setSelfAsMinter skipped (token may not support setMinter)");
      })
    );
  }

  for (const t of tasks) {
    try { await t; } catch (e) { console.log("post-setup step failed:", e?.message || e); }
  }

  // 3) Ownership transfer
  const newOwner = (process.env.RELAYER_OWNER || "").trim();
  if (newOwner && ethers.utils.isAddress(newOwner) && newOwner.toLowerCase() !== deployerAddr.toLowerCase()) {
    console.log("Transferring ownership to:", newOwner);
    try {
      const tx = await bridgeAttached.transferOwnership(newOwner);
      await tx.wait();
      console.log("Ownership transferred.");
    } catch (e) {
      console.log("transferOwnership failed:", e?.message || e);
    }
  } else {
    console.log("transferOwnership skipped (RELAYER_OWNER not set or same as deployer).");
  }

  // 4) Verify
  try {
    console.log("Verifying on Etherscan...");
    await run("verify:verify", { address: bridgeAddress, constructorArguments: [] });
    console.log("Verified.");
  } catch (e) {
    console.log("Verify skipped/failed:", e?.message || e);
  }

  console.log("✅ Done. Bridge address:", bridgeAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
