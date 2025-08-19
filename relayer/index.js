require("dotenv").config();
const express = require("express");
const ethers = require("ethers");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios"); // + Discord webhook

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Provider / Wallet / Contract ----------
const provider = new ethers.providers.JsonRpcProvider(process.env.PGIRLSCHAIN_RPC_URL);

// Ethereum(L1) 読み書き兼用プロバイダ & 払い出しEOA
const ethReadProvider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
const ethPayoutWallet = new ethers.Wallet(process.env.ETH_PAYOUT_PRIVATE_KEY, ethReadProvider);

// PGirlsChain 側の管理ウォレット（ブリッジMint/Burn用）
const wallet = new ethers.Wallet(process.env.PGIRLSCHAIN_PRIVATE_KEY, provider);

// ABI 読み込み
const abiPath = path.join(__dirname, "abi", "EIP712Bridge.json");
const bridgeAbi = JSON.parse(fs.readFileSync(abiPath)).abi;
const bridge = new ethers.Contract(
  process.env.PGIRLS_BRIDGE_CONTRACT_ADDRESS,
  bridgeAbi,
  wallet
);

// nonce 再利用防止
const usedNonces = new Set();

// ---- Rate PGirls -> ETH (例: 0.018 ETH / 1 PGirls) using integer ratio ----
// ※ amount は PGirls の最小単位(10^decimals; 通常は1e18)で渡ってくる前提
const RATE_NUM = ethers.BigNumber.from(process.env.RATE_NUM || "18");   // numerator
const RATE_DEN = ethers.BigNumber.from(process.env.RATE_DEN || "1000"); // denominator

// ---- ERC20 minimal ABI & PGirls token instance ----
const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const pgirlsToken = new ethers.Contract(
  process.env.PGIRLS_CONTRACT_ADDRESS,
  erc20Abi,
  provider
);

// ---------- Discord helper ----------
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || "";
async function postDiscord(content) {
  if (!DISCORD_WEBHOOK) return;
  try {
    await axios.post(DISCORD_WEBHOOK, { content });
  } catch (e) {
    console.error("Discord webhook error:", e?.response?.status || e?.message || e);
  }
}

function fmt(num, decimals = 18) {
  try { return ethers.utils.formatUnits(num, decimals); } catch (_) { return "0"; }
}
function safeAddr(a) { return ethers.utils.isAddress(a || "") ? a : ""; }

function completedMsg({ user, from, to, amount, ethTxHash, relayerTx }) {
  return (
    `? Bridge Completed\n` +
    `User: ${user}\n` +
    `From: ${from}\n` +
    `To: ${to}\n` +
    `Amount: ${amount}\n` +
    `ETH TxHash: ${ethTxHash || "-"}\n` +
    `Relayer TX: ${relayerTx || "-"}`
  );
}
function errorMsg({ user, from, to, amount, error }) {
  return (
    `? Bridge Error \n` +
    `User: ${user || ""}\n` +
    `From: ${from}\n` +
    `To: ${to}\n` +
    `Amount: ${amount || "0"}\n` +
    `Error: ${error}`
  );
}

function parseBN(input, label) {
  if (
    input === undefined ||
    input === null ||
    (typeof input !== "string" && typeof input !== "number")
  ) {
    throw new Error(`Missing or invalid type for ${label}`);
  }
  const inputStr = input.toString().trim();
  if (!/^\d+$/.test(inputStr)) {
    throw new Error(`Invalid numeric string for ${label}: "${inputStr}"`);
  }
  try {
    return ethers.BigNumber.from(inputStr);
  } catch (e) {
    throw new Error(`Invalid BigNumber string for ${label}: "${inputStr}"`);
  }
}

// ---------- POST /bridge-pgirls (ETH -> PGirls) ----------
app.post("/bridge-pgirls", async (req, res) => {
  let user = ""; let bnAmount = ethers.BigNumber.from(0); let ethTxHash = "";
  try {
    console.log(">> Received bridge-pgirls:", req.body);

    const { amount, nonce, signature } = req.body;
    user = safeAddr(req.body.user);
    ethTxHash = (req.body.ethTxHash || "").toString(); // client passes the deposit tx

    bnAmount = parseBN(amount, "amount");
    const bnNonce = parseBN(nonce, "nonce");

    if (!user || !signature) {
      const msg = "Missing required fields";
      await postDiscord(errorMsg({ user, from: "ETH", to: "PGirls", amount: fmt(bnAmount), error: msg }));
      return res.status(400).json({ error: msg });
    }
    if (!ethers.utils.isAddress(user)) {
      const msg = "Invalid user address";
      await postDiscord(errorMsg({ user, from: "ETH", to: "PGirls", amount: fmt(bnAmount), error: msg }));
      return res.status(400).json({ error: msg });
    }
    if (usedNonces.has(bnNonce.toString())) {
      const msg = "Nonce already used";
      await postDiscord(errorMsg({ user, from: "ETH", to: "PGirls", amount: fmt(bnAmount), error: msg }));
      return res.status(409).json({ error: msg });
    }

    const domain = {
      name: "PGirlsBridge",
      version: "1",
      chainId: Number(process.env.CHAIN_ID), // PGirlsChain の chainId
      verifyingContract: process.env.PGIRLS_BRIDGE_CONTRACT_ADDRESS,
    };
    const types = {
      Bridge: [
        { name: "user", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };
    const value = { user, amount: bnAmount, nonce: bnNonce };

    console.log("verifyTypedData domain:", domain);
    const recovered = ethers.utils.verifyTypedData(domain, types, value, signature);
    if (recovered.toLowerCase() !== user.toLowerCase()) {
      const msg = "Signature verification failed";
      await postDiscord(errorMsg({ user, from: "ETH", to: "PGirls", amount: fmt(bnAmount), error: msg }));
      return res.status(401).json({ error: msg });
    }

    const tx = await bridge.bridgeToPGirls(user, bnAmount);
    await tx.wait();

    usedNonces.add(bnNonce.toString());

    const content = completedMsg({
      user,
      from: "ETH",
      to: "PGirls",
      amount: fmt(bnAmount, 18), // ETH amount
      ethTxHash,
      relayerTx: tx.hash, // PGirls mint tx
    });
    await postDiscord(content);

    console.log(`? Minted PGirls to ${user} | amount=${bnAmount.toString()} | tx=${tx.hash}`);
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("!! /bridge-pgirls error:", err);
    const msg = err?.message || String(err);
    await postDiscord(errorMsg({ user, from: "ETH", to: "PGirls", amount: fmt(bnAmount, 18), error: msg }));
    res.status(500).json({ error: msg });
  }
});

// ---------- POST /bridge-eth (PGirls -> ETH) ----------
app.post("/bridge-eth", async (req, res) => {
  let user = ""; let bnAmount = ethers.BigNumber.from(0);
  try {
    console.log(">> Received bridge-eth:", req.body);

    const { amount, nonce, signature, chainId } = req.body;
    user = safeAddr(req.body.user);

    bnAmount = parseBN(amount, "amount"); // PGirls(wei)
    const bnNonce = parseBN(nonce, "nonce");

    if (!user || !signature) {
      const msg = "Missing required fields";
      await postDiscord(errorMsg({ user, from: "PGirls", to: "ETH", amount: fmt(bnAmount), error: msg }));
      return res.status(400).json({ error: msg });
    }
    if (!ethers.utils.isAddress(user)) {
      const msg = "Invalid user address";
      await postDiscord(errorMsg({ user, from: "PGirls", to: "ETH", amount: fmt(bnAmount), error: msg }));
      return res.status(400).json({ error: msg });
    }
    if (usedNonces.has(bnNonce.toString())) {
      const msg = "Nonce already used";
      await postDiscord(errorMsg({ user, from: "PGirls", to: "ETH", amount: fmt(bnAmount), error: msg }));
      return res.status(409).json({ error: msg });
    }

    // 署名検証（chainId はサーバ設定値に固定し、bodyの chainId とは別に検証）
    const expectedChainId = Number(process.env.CHAIN_ID);
    if (chainId !== undefined && Number(chainId) !== expectedChainId) {
      const msg = "Wrong chainId";
      await postDiscord(errorMsg({ user, from: "PGirls", to: "ETH", amount: fmt(bnAmount), error: msg }));
      return res.status(400).json({ error: msg });
    }
    const domain = {
      name: "PGirlsBridge",
      version: "1",
      chainId: expectedChainId, // PGirlsChain の chainId
      verifyingContract: process.env.PGIRLS_BRIDGE_CONTRACT_ADDRESS,
    };
    const types = {
      Bridge: [
        { name: "user", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };
    const value = { user, amount: bnAmount, nonce: bnNonce };

    const recovered = ethers.utils.verifyTypedData(domain, types, value, signature);
    if (recovered.toLowerCase() !== user.toLowerCase()) {
      const msg = "Signature verification failed";
      await postDiscord(errorMsg({ user, from: "PGirls", to: "ETH", amount: fmt(bnAmount), error: msg }));
      return res.status(403).json({ error: msg });
    }

    // PGirls(wei) → ETH(wei) への変換
    const payoutWei = bnAmount.mul(RATE_NUM).div(RATE_DEN);
    if (payoutWei.lte(0)) {
      const msg = "amount too small";
      await postDiscord(errorMsg({ user, from: "PGirls", to: "ETH", amount: fmt(bnAmount), error: msg }));
      return res.status(400).json({ error: msg });
    }

    // 払い出しEOAの残高チェック
    const relayerBal = await ethPayoutWallet.getBalance();
    if (relayerBal.lt(payoutWei)) {
      const msg = "Relayer EOA has insufficient ETH";
      await postDiscord(errorMsg({ user, from: "PGirls", to: "ETH", amount: fmt(bnAmount), error: msg }));
      return res.status(402).json({ error: msg });
    }

    // Ethereum(L1) の EOA から送金
    const tx = await ethPayoutWallet.sendTransaction({ to: user, value: payoutWei });
    await tx.wait(1); // 1 confirmation 以上推奨

    usedNonces.add(bnNonce.toString());

    // NOTE: 完了フォーマットは指示通り固定。PGirls→ETH でも ETH TxHash は送金トランザクションを記載します。
    const content = completedMsg({
      user,
      from: "PGirls",
      to: "ETH",
      amount: fmt(bnAmount, 18), // PGirls amount（From 側の数量）
      ethTxHash: tx.hash,        // payout on ETH
      relayerTx: tx.hash,        // destination relayer tx is同一
    });
    await postDiscord(content);

    console.log(
      `? PGirls→ETH payout | to=${user} | pgirlsWei=${bnAmount.toString()} | ethWei=${payoutWei.toString()} | tx=${tx.hash}`
    );
    res.json({ success: true, txHash: tx.hash, amountWei: payoutWei.toString(), to: user });
  } catch (err) {
    console.error("!! /bridge-eth error:", err);
    const msg = err?.message || String(err);
    await postDiscord(errorMsg({ user, from: "PGirls", to: "ETH", amount: fmt(bnAmount, 18), error: msg }));
    res.status(500).json({ error: msg });
  }
});

// ---------- READ-ONLY: Balances ----------
app.get("/balance/eth/:addr", async (req, res) => {
  try {
    const { addr } = req.params;
    if (!ethers.utils.isAddress(addr)) return res.status(400).json({ error: "bad address" });
    const b = await ethReadProvider.getBalance(addr);
    res.json({ balance: b.toString(), decimals: 18 });
  } catch (e) {
    console.error("GET /balance/eth error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/balance/pgirls/:addr", async (req, res) => {
  try {
    const { addr } = req.params;
    if (!ethers.utils.isAddress(addr)) return res.status(400).json({ error: "bad address" });
    const [b, d] = await Promise.all([pgirlsToken.balanceOf(addr), pgirlsToken.decimals()]);
    res.json({ balance: b.toString(), decimals: Number(d) });
  } catch (e) {
    console.error("GET /balance/pgirls error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- start ----------
const PORT = process.env.R_PORT || 3005;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`? Relayer running at http://0.0.0.0:${PORT}`);
});