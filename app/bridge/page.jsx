"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { ShieldCheck } from "lucide-react";

// ---- Minimal ABIs (no external artifact import) ----
const BRIDGE_ABI = [
  "function bridgeToPGirls(address user, uint256 ethAmount) external",
  "function bridgeToETH(uint256 tokenAmount) external",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export default function Page() {
  // --- Reload on ChunkLoadError (Android/old cache) ---
  useEffect(() => {
    const handler = (e) => {
      const msg = (e && (e.reason?.name || e.reason?.message || e.message)) || "";
      if (/ChunkLoadError|Loading chunk/i.test(String(msg))) {
        try { sessionStorage.setItem("lastChunkReload", String(Date.now())); } catch(_) {}
        window.location.reload();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  // ---- UI state ----
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("PGirls");
  const [balances, setBalances] = useState({ ETH: "0", PGirls: "0" });
  const [amount, setAmount] = useState("0");
  const [calculatedAmount, setCalculatedAmount] = useState("0");

  const isReconnectingRef = useRef(false);

  // ---- Env / Chain config ----
  const ETH_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ETH_CHAIN_ID || 1);
  const PGIRLS_CHAIN_ID = Number(process.env.NEXT_PUBLIC_PGIRLS_CHAIN_ID || 20250511);

  const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || "";
  const DISCORD_WEBHOOK = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || "";

  const ETH_BRIDGE_ADDRESS = process.env.NEXT_PUBLIC_ETH_BRIDGE_CONTRACT_ADDRESS || process.env.ETH_BRIDGE_CONTRACT_ADDRESS || "";
  const PGIRLS_BRIDGE_ADDRESS = process.env.NEXT_PUBLIC_PGIRLS_BRIDGE_CONTRACT_ADDRESS || process.env.PGIRLS_BRIDGE_CONTRACT_ADDRESS || "";
  const PGIRLS_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_PGIRLS_CONTRACT_ADDRESS || process.env.PGIRLS_CONTRACT_ADDRESS || "";

  const PGIRLS_RPC_URL = process.env.NEXT_PUBLIC_PGIRLSCHAIN_RPC_URL || process.env.PGIRLSCHAIN_RPC_URL || "https://rpc.rahabpunkaholicgirls.com";
  const PGIRLS_EXPLORER = process.env.NEXT_PUBLIC_PGIRLS_EXPLORER_URL || "https://explorer.rahpunkaholicgirls.com";

  const tokens = {
    ETH: { symbol: "ETH", network: "Ethereum", decimals: 18, chainId: ETH_CHAIN_ID, address: ethers.constants.AddressZero, bridgeAddress: ETH_BRIDGE_ADDRESS },
    PGirls: { symbol: "PGirls", network: "PGirlsChain", decimals: 18, chainId: PGIRLS_CHAIN_ID, address: PGIRLS_TOKEN_ADDRESS, bridgeAddress: PGIRLS_BRIDGE_ADDRESS },
  };

  const validPairs = [["ETH","PGirls"],["PGirls","ETH"]];
  const exchangeRates = { "ETH:PGirls": 1 / 0.018, "PGirls:ETH": 0.018 };

  const isValidPair = useCallback((f, t) => validPairs.some(([ff, tt]) => ff === f && tt === t), []);
  const calcAmount = useCallback((fromAmount, f, t) => {
    const n = parseFloat(fromAmount);
    if (!fromAmount || isNaN(n) || n === 0) return "0";
    const rate = exchangeRates[`${f}:${t}`];
    return ((rate || 1) * n).toFixed(18);
  }, []);

  useEffect(() => {
    setCalculatedAmount(calcAmount(amount, fromToken, toToken));
  }, [amount, fromToken, toToken, calcAmount]);

  const getActiveEip1193 = useCallback(() => {
    if (typeof window !== "undefined" && window.ethereum) return window.ethereum;
    return null;
  }, []);

  const checkIfWalletIsInstalled = () => typeof window !== "undefined" && typeof window.ethereum !== "undefined";

  const formatBalance = useCallback(
    (v) => isNaN(parseFloat(v)) ? "0" : parseFloat(v).toLocaleString(undefined, { maximumFractionDigits: 6 }),
    []
  );
  const formatAddress = useCallback((a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ""), []);

  const clampToDigits18 = (input) => {
    if (!input) return "0";
    let v = input.replace(/[０-９．]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 65248)).replace(/。/g, ".").replace("．", ".").replace(/[^0-9.]/g, "");
    const parts = v.split(".");
    if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
    const [intPart, decPart = ""] = v.split(".");
    const trimmedDec = decPart.slice(0, 18);
    v = decPart.length ? `${intPart || "0"}.${trimmedDec}` : intPart || "0";
    v = v.replace(/^0+(?=\d)/, "0");
    return v;
  };
  const clampToBalance = (val, balStr) => {
    const n = parseFloat(val || "0");
    const b = parseFloat(balStr || "0");
    if (isNaN(n)) return "0";
    if (n > b) return (b || 0).toString();
    return val;
  };

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    setAccount(null);
    setBalances({ ETH: "0", PGirls: "0" });
    setSuccess(""); setError("");
  }, []);

  // listeners
  const updateBalances = useCallback(async (addr) => {
    if (!addr) return;
    const r = {};
    try { r.ETH = await getTokenBalance("ETH", addr); } catch { r.ETH = "0"; }
    try { r.PGirls = await getTokenBalance("PGirls", addr); } catch { r.PGirls = "0"; }
    setBalances(r);
  }, []);

  const handleAccountsChanged = useCallback((accounts) => {
    if (!accounts || accounts.length === 0) { handleDisconnect(); }
    else { setAccount(accounts[0]); setConnected(true); updateBalances(accounts[0]); }
  }, [handleDisconnect, updateBalances]);

  const handleChainChanged = useCallback(async (chainIdHex) => {
    const parsed = typeof chainIdHex === "string" ? parseInt(chainIdHex, 16) : Number(chainIdHex);
    const allowed = [ETH_CHAIN_ID, PGIRLS_CHAIN_ID];
    if (!allowed.includes(parsed)) return;
    if (isReconnectingRef.current) return;
    isReconnectingRef.current = true;
    try { await connectWallet(); } finally { setTimeout(() => { isReconnectingRef.current = false; }, 1200); }
  }, [ETH_CHAIN_ID, PGIRLS_CHAIN_ID]);

  useEffect(() => {
    if (!checkIfWalletIsInstalled()) return;
    const eth = typeof window !== "undefined" ? window.ethereum : null;
    if (eth?.on) {
      eth.removeListener?.("accountsChanged", handleAccountsChanged);
      eth.removeListener?.("chainChanged", handleChainChanged);
      eth.on?.("accountsChanged", handleAccountsChanged);
      eth.on?.("chainChanged", handleChainChanged);
    }
    return () => {
      eth?.removeListener?.("accountsChanged", handleAccountsChanged);
      eth?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [handleAccountsChanged, handleChainChanged]);

  const connectWallet = useCallback(async () => {
    try {
      setError(""); setSuccess(""); setLoading(true);
      if (!checkIfWalletIsInstalled()) { setError("Please install MetaMask"); return; }
      const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setConnected(true);
        setAccount(accounts[0]);
        await updateBalances(accounts[0]);
      } else {
        const req = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (req?.length > 0) {
          setConnected(true);
          setAccount(req[0]);
          await updateBalances(req[0]);
        }
      }
    } catch (e) { console.error("connectWallet error:", e); setError(e?.message || "Failed to connect wallet"); }
    finally { setLoading(false); }
  }, [updateBalances]);

  // ---- Network helpers ----
  async function checkAndSwitchNetwork(targetChainId) {
    if (!checkIfWalletIsInstalled()) return false;
    const active = getActiveEip1193();
    if (!active) return false;
    try {
      const currentHex = await active.request({ method: "eth_chainId" });
      const current = parseInt(currentHex, 16);
      if (current === Number(targetChainId)) return true;
      const targetHex = "0x" + Number(targetChainId).toString(16);
      try {
        await active.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetHex }] });
        return true;
      } catch (switchErr) {
        const code = switchErr?.code || switchErr?.data?.originalError?.code || null;
        const needsAdd = code === 4902 || /Unrecognized chain ID|not added/i.test(String(switchErr?.message || ""));
        if (needsAdd && Number(targetChainId) === Number(PGIRLS_CHAIN_ID)) {
          try {
            await active.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: targetHex,
                chainName: "PGirlsChain",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: [PGIRLS_RPC_URL].filter(Boolean),
                blockExplorerUrls: [PGIRLS_EXPLORER].filter(Boolean),
              }],
            });
            return true;
          } catch (addErr) {
            console.error("wallet_addEthereumChain failed:", addErr);
            return false;
          }
        }
        console.warn("Switch chain failed:", switchErr);
        return false;
      }
    } catch (err) { console.error("checkAndSwitchNetwork error:", err); return false; }
  }

  async function waitForChainId(targetId, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    const active = getActiveEip1193();
    while (Date.now() < deadline) {
      try {
        const hex = await active.request({ method: "eth_chainId" });
        if (parseInt(hex, 16) === Number(targetId)) return true;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 250));
    }
    return false;
  }

  const isIOSMetaMask = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/.test(ua) && /MetaMask/i.test(ua);
  };

  async function ensureChain(targetId) {
    const active = getActiveEip1193();
    if (!active) return false;
    try {
      const hex0 = await active.request({ method: "eth_chainId" });
      const cur0 = parseInt(hex0, 16);
      if (cur0 === Number(targetId)) return true;
    } catch (_) {}
    const targetHex = "0x" + Number(targetId).toString(16);
    try {
      await active.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetHex }] });
    } catch (switchErr) {
      const code = switchErr?.code || switchErr?.data?.originalError?.code || null;
      const needsAdd = code === 4902 || /Unrecognized chain ID|not added/i.test(String(switchErr?.message || ""));
      if (needsAdd) {
        try {
          await active.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: targetHex,
              chainName: "PGirlsChain",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [PGIRLS_RPC_URL].filter(Boolean),
              blockExplorerUrls: [PGIRLS_EXPLORER].filter(Boolean),
            }],
          });
        } catch (addErr) {
          console.warn("wallet_addEthereumChain failed:", addErr);
          return false;
        }
      } else {
        console.warn("wallet_switchEthereumChain failed:", switchErr);
      }
    }
    // event-or-poll
    let resolved = false;
    try {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3000);
        if (typeof window !== "undefined" && window.ethereum && window.ethereum.once) {
          try {
            window.ethereum.once("chainChanged", () => { resolved = true; clearTimeout(timer); resolve(); });
          } catch (_) { /* ignore */ }
        }
      });
    } catch (_) {}
    if (!resolved) {
      const ok = await waitForChainId(targetId, 10000);
      if (!ok) return false;
    }
    await new Promise(r => setTimeout(r, isIOSMetaMask() ? 300 : 100));
    return true;
  }

  async function ensureChainIOSAware(targetId) {
    const ok = await ensureChain(targetId);
    if (!ok) return false;
    const active = getActiveEip1193();
    if (!active) return false;
    const provider = new ethers.providers.Web3Provider(active, "any");
    let confirmed = false;
    const deadline = Date.now() + (isIOSMetaMask() ? 20000 : 8000);
    while (Date.now() < deadline) {
      try {
        const id = await provider.getNetwork().then(n => n.chainId).catch(async () => (await active.request({ method: "eth_chainId" })));
        const num = typeof id === "string" ? parseInt(id, 16) : Number(id);
        if (num === Number(targetId)) { confirmed = true; break; }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 300));
    }
    if (!confirmed) return false;
    if (isIOSMetaMask()) await new Promise(r => setTimeout(r, 300));
    return true;
  }

  function checksum(addr) {
    try { return ethers.utils.getAddress(addr); } catch { return addr; }
  }

  async function postDiscord(content) {
    try { if (DISCORD_WEBHOOK) await axios.post(DISCORD_WEBHOOK, { content }); } catch (_) {}
  }

  // ---- Balance via relayer endpoints (read-only) ----
  const getTokenBalance = useCallback(async (symbol, userAddr) => {
    try {
      if (!ethers.utils.isAddress(userAddr) || !RELAYER_URL) return "0";
      let endpoint = "";
      if (symbol === "ETH") endpoint = `${RELAYER_URL}/balance/eth/${userAddr}`;
      else if (symbol === "PGirls") endpoint = `${RELAYER_URL}/balance/pgirls/${userAddr}`;
      else return "0";
      const { data } = await axios.get(endpoint);
      return ethers.utils.formatUnits(data.balance || "0", data.decimals ?? 18);
    } catch (e) { console.error(`getTokenBalance(${symbol}) error:`, e); return "0"; }
  }, [RELAYER_URL]);

  // ---- EIP-712 sign ----
  async function signTypedData(signer, user, nonce, amountWei, verifyingContract, chainIdOverride) {
    const chainId = chainIdOverride ?? (await signer.getChainId());
    const domain = { name: "PGirlsBridge", version: "1", chainId, verifyingContract };
    const types = { Bridge: [ { name: "user", type: "address" }, { name: "amount", type: "uint256" }, { name: "nonce", type: "uint256" } ] };
    const value = { user, amount: ethers.BigNumber.from(amountWei.toString()), nonce: ethers.BigNumber.from(nonce) };
    try {
      // eslint-disable-next-line no-underscore-dangle
      return await signer._signTypedData(domain, types, value);
    } catch (e) {
      const active = getActiveEip1193();
      if (!active) throw e;
      const typed = {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          Bridge: types.Bridge,
        },
        domain,
        primaryType: "Bridge",
        message: { user, amount: amountWei.toString(), nonce: String(nonce) },
      };
      try {
        const activeHex = await active.request({ method: "eth_chainId" });
        const activeId = parseInt(activeHex, 16);
        if (Number(activeId) !== Number(domain.chainId)) {
          const switched = await ensureChainIOSAware(Number(domain.chainId));
          if (!switched) throw new Error("Please switch to PGirlsChain in MetaMask and try again.");
        }
      } catch (_) {}
      return await active.request({
        method: "eth_signTypedData_v4",
        params: [ user, JSON.stringify(typed) ],
      });
    }
  }

  // ---------------- Bridge Handler ----------------
  const handleBridge = useCallback(async () => {
    setLoading(true);
    setError(""); setSuccess("");

    try {
      const raw = (amount ?? "").toString().trim();
      let safe = clampToDigits18(raw);
      safe = clampToBalance(safe, balances[fromToken]);

      if (!safe || isNaN(parseFloat(safe)) || parseFloat(safe) <= 0) {
        setError("Please enter a valid amount");
        return;
      }
      const fromBal = parseFloat(balances[fromToken] || "0");
      if (fromBal < parseFloat(safe)) { setError(`Insufficient ${fromToken} balance`); return; }

      // ---- PGirls -> ETH ----
      if (fromToken === "PGirls" && toToken === "ETH") {
        if (!PGIRLS_BRIDGE_ADDRESS || !PGIRLS_TOKEN_ADDRESS) { setError("Bridge or token address is not set for PGirlsChain"); return; }
        if (!(await ensureChainIOSAware(PGIRLS_CHAIN_ID))) { setError("Please switch to PGirlsChain"); return; }

        const active = getActiveEip1193();
        const pgProvider = new ethers.providers.Web3Provider(active, "any");
        const pgSigner = pgProvider.getSigner();
        const user = await pgSigner.getAddress();

        const token = new ethers.Contract(PGIRLS_TOKEN_ADDRESS, ERC20_ABI, pgSigner);
        const decimals = await token.decimals();
        const amountPG = ethers.utils.parseUnits(safe, decimals);

        const curAllowance = await token.allowance(user, PGIRLS_BRIDGE_ADDRESS);
        if (curAllowance.lt(amountPG)) {
          if (!curAllowance.isZero()) { const reset = await token.approve(PGIRLS_BRIDGE_ADDRESS, 0); await reset.wait(); }
          const approve = await token.approve(PGIRLS_BRIDGE_ADDRESS, amountPG); await approve.wait();
        }

        const bridge = new ethers.Contract(PGIRLS_BRIDGE_ADDRESS, BRIDGE_ABI, pgSigner);
        const burnTx = await bridge.bridgeToETH(amountPG);
        await burnTx.wait();

        const nonce = Math.floor(Date.now() / 1000);
        await ensureChainIOSAware(PGIRLS_CHAIN_ID);
        const signature = await signTypedData(
          pgSigner, user, nonce, amountPG.toString(), PGIRLS_BRIDGE_ADDRESS, PGIRLS_CHAIN_ID
        );

        if (RELAYER_URL) {
          await axios.post(`${RELAYER_URL}/bridge-eth`, {
            user, amount: amountPG.toString(), nonce, signature,
            chainId: PGIRLS_CHAIN_ID, srcChainId: PGIRLS_CHAIN_ID, dstChainId: ETH_CHAIN_ID,
            burnTxHash: burnTx.hash,
          });
        }

        await updateBalances(user);
        const burnLink = `${PGIRLS_EXPLORER}/tx/${burnTx.hash}`;
        setSuccess(
          <>
            Bridge request submitted. Waiting for relayer to send ETH. PGirlsChain tx:{" "}
            <a href={burnLink} target="_blank" rel="noopener noreferrer">{burnTx.hash}</a>
          </>
        );
        setAmount("0");
        return;
      }

      // ---- ETH -> PGirls ----
      if (fromToken === "ETH" && toToken === "PGirls") {
        if (!ETH_BRIDGE_ADDRESS) { setError("ETH bridge address is not configured"); return; }

        if (!(await ensureChainIOSAware(ETH_CHAIN_ID))) { setError("Please switch to Ethereum"); return; }
        const activeEth = getActiveEip1193();
        const ethProvider = new ethers.providers.Web3Provider(activeEth, "any");
        const ethSigner = ethProvider.getSigner();
        const user = await ethSigner.getAddress();
        const amountWei = ethers.utils.parseEther(safe);

        const sendTx = await ethSigner.sendTransaction({ to: ETH_BRIDGE_ADDRESS, value: amountWei });
        const receipt = await sendTx.wait();

        await new Promise(r => setTimeout(r, 300));
        const okWait = await waitForChainId(PGIRLS_CHAIN_ID, 8000);
        if (!okWait) {
          const ok2 = await ensureChainIOSAware(PGIRLS_CHAIN_ID);
          if (!ok2) { setError("Please switch to PGirlsChain"); return; }
        }

        await ensureChainIOSAware(PGIRLS_CHAIN_ID);
        const activePg = getActiveEip1193();
        const pgProvider = new ethers.providers.Web3Provider(activePg, "any");
        const pgSigner = pgProvider.getSigner();
        const activeId = await pgSigner.getChainId();
        if (Number(activeId) !== Number(PGIRLS_CHAIN_ID)) {
          setError(`Active chainId is 0x${Number(activeId).toString(16)} but received 0x${Number(PGIRLS_CHAIN_ID).toString(16)}`);
          return;
        }

        const verifyingContract = checksum(PGIRLS_BRIDGE_ADDRESS);
        const nonce = Math.floor(Date.now() / 1000);

        await ensureChainIOSAware(PGIRLS_CHAIN_ID);
        const signature = await signTypedData(pgSigner, user, nonce, amountWei.toString(), verifyingContract, Number(activeId));

        let pgTxHash = "";
        if (RELAYER_URL) {
          const resp = await axios.post(`${RELAYER_URL}/bridge-pgirls`, {
            user, amount: amountWei.toString(), nonce, signature,
            ethTxHash: sendTx.hash, srcChainId: ETH_CHAIN_ID, dstChainId: PGIRLS_CHAIN_ID,
          });
          pgTxHash = resp?.data?.txHash || "";
        }

        await updateBalances(user);
        const explorerLink = pgTxHash ? `${PGIRLS_EXPLORER}/tx/${pgTxHash}` : "";
        setSuccess(
          <>
            Bridge request submitted. ETH sent (tx: {receipt.transactionHash}).{" "}
            {pgTxHash && (
              <>PGirlsChain tx: <a href={explorerLink} target="_blank" rel="noopener noreferrer">{pgTxHash}</a></>
            )}
          </>
        );
        setAmount("0");
        return;
      }

      setError("Unsupported token pair. Please choose ETH ↔︎ PGirls.");
    } catch (err) {
      const msg = err?.reason || err?.message || "Bridge transaction failed";
      setError(msg);
      try {
        const active = getActiveEip1193();
        const provider = new ethers.providers.Web3Provider(active || window.ethereum);
        const signer = provider.getSigner();
        const user = await signer.getAddress().catch(() => "");
        await postDiscord(`❌ **Bridge Error**\nUser: ${user}\nFrom: ${fromToken}\nTo: ${toToken}\nAmount: ${amount || "0"}\nError: ${msg}`);
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  }, [amount, balances, fromToken, toToken, ETH_CHAIN_ID, PGIRLS_CHAIN_ID]);

  // --- auto-clamp when balances or fromToken change ---
  useEffect(() => {
    const n = parseFloat(amount || "0"); const max = parseFloat(balances[fromToken] || "0");
    if (!isNaN(n) && n > max) setAmount((max || 0).toString());
  }, [balances, fromToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------- JSX --------------------
  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: "#000", padding: 20 }}>
      {connected && account && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginBottom: 20, padding: "8px 16px", backgroundColor: "#f8fafc", borderRadius: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: 14, color: "#4a5568" }}>{formatAddress(account)}</span>
          <button onClick={handleDisconnect} disabled={loading} style={{ color: "#f97316", background: "none", border: "1px solid #f97316", padding: "4px 12px", fontSize: 14, cursor: loading ? "not-allowed" : "pointer", borderRadius: 6, opacity: loading ? 0.7 : 1, transition: "all .2s ease" }}>Disconnect</button>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: "960px", margin: "0 auto", padding: 20, display: "flex", justifyContent: "center" }}>
        <div className="bridge-card-wrap">
          <div style={{ textAlign: "center", marginBottom: 40, fontSize: 24, fontWeight: "bold" }}>
            Swap & Bridge Anywhere,<br />Anytime
          </div>

          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 14, color: "#4a5568", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldCheck size={16} />
                <span>Secure</span>
              </div>
            </div>

            {/* From */}
            <div style={{ marginBottom: 24 }}>
              <div className="row">
                <select value={fromToken} onChange={(e) => {
                  const nf = e.target.value;
                  if (!["ETH", "PGirls"].includes(nf)) return;
                  if ((nf === "ETH" && toToken !== "PGirls") || (nf === "PGirls" && toToken !== "ETH")) { setToToken(nf === "ETH" ? "PGirls" : "ETH"); }
                  setFromToken(nf); setError(""); setSuccess("");
                }} className="sel">
                  {Object.entries(tokens).map(([sym, t]) => (
                    <option key={sym} value={sym}>{sym} ({t.network})</option>
                  ))}
                </select>

                <div className="inp-wrap">
                  <input type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" value={amount} onChange={(e) => {
                    let v = e.target.value.replace(/[^0-9.]/g, "");
                    if (v.split(".").length > 2) return;
                    if (v.startsWith(".")) v = "0" + v;
                    if (v === "") { setAmount(""); setCalculatedAmount("0"); return; }
                    const num = parseFloat(v);
                    if (!isNaN(num)) {
                      const max = parseFloat(balances[fromToken] || "0");
                      if (num > max) v = max.toString();
                      if (num < 0) v = "0";
                    }
                    setAmount(v);
                    setCalculatedAmount(calcAmount(v || "0", fromToken, toToken));
                  }} placeholder="0.0" className="inp" />
                  <button type="button" className="max-btn" disabled={loading || parseFloat(balances[fromToken] || "0") === 0} onClick={() => {
                    const max = balances[fromToken] || "0";
                    setAmount(max);
                    setCalculatedAmount(calcAmount(max || "0", fromToken, toToken));
                  }}>MAX</button>
                </div>
              </div>
              <div style={{ fontSize: 14, color: "#666", textAlign: "right" }}>Balance: {formatBalance(balances[fromToken])} {fromToken}</div>
            </div>

            {/* To */}
            <div style={{ marginBottom: 24 }}>
              <div className="row">
                <select value={toToken} onChange={(e) => {
                  const nt = e.target.value;
                  if (!["ETH", "PGirls"].includes(nt)) return;
                  if ((fromToken === "ETH" && nt !== "PGirls") || (fromToken === "PGirls" && nt !== "ETH")) { setFromToken(nt === "ETH" ? "PGirls" : "ETH"); }
                  setToToken(nt); setError(""); setSuccess(""); setCalculatedAmount(calcAmount(amount, fromToken, nt));
                }} className="sel">
                  {Object.entries(tokens).map(([sym, t]) => (
                    <option key={sym} value={sym} disabled={!isValidPair(fromToken, sym)}>{sym} ({t.network})</option>
                  ))}
                </select>

                <input type="text" inputMode="decimal" value={calculatedAmount} disabled placeholder="0.0" className="inp inp-readonly" />
              </div>

              <div style={{ fontSize: 14, color: "#666", textAlign: "right" }}>Balance: {formatBalance(balances[toToken])} {toToken}</div>
              <div style={{ fontSize: 14, color: "#666", textAlign: "right", marginTop: 4 }}>Rate: 1 {fromToken} = {formatBalance(exchangeRates[`${fromToken}:${toToken}`] || 1)} {toToken}</div>
            </div>

            {!connected ? (
              <div style={{display:"grid", gap:10}}>
                <button
                  onClick={connectWallet}
                  disabled={loading}
                  style={{ width:"100%", padding:12, background:"#f97316", color:"#fff", border:"none", borderRadius:12, fontSize:16, fontWeight:"bold", opacity:loading?0.75:1, cursor:loading?"not-allowed":"pointer"}}
                >
                  {loading ? "Connecting..." : "MetaMask / Injected"}
                </button>
              </div>
            ) : (
              <button
                onClick={handleBridge}
                disabled={loading}
                style={{ width:"100%", padding:12, background:"#f97316", color:"#fff", border:"none", borderRadius:12, fontSize:16, fontWeight:"bold", opacity:loading?0.75:1, cursor:loading?"not-allowed":"pointer"}}
              >
                {loading ? "Bridging..." : "Bridge"}
              </button>
            )}

            {!!error && (
              <div style={{ color: "#ff4444", textAlign: "center", marginTop: 10, padding: 10, backgroundColor: "rgba(255,68,68,0.1)", borderRadius: 8 }}>{error}</div>
            )}

            {!!success && (
              <div style={{ color: "#0a7d34", textAlign: "center", marginTop: 10, padding: 10, backgroundColor: "rgba(10,125,52,0.08)", borderRadius: 8 }}>{success}</div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .bridge-card-wrap { width: 100%; }
        @media (min-width: 992px) { .bridge-card-wrap { width: 40vw; } }
        .row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .sel { flex: 3; min-width: 0; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .inp-wrap { position: relative; flex: 7; display: flex; align-items: center; width: 100%; }
        .inp { flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; text-align: right; font-variant-numeric: tabular-nums; padding-right: 56px; }
        .inp-readonly { background: #f8fafc; text-align: right; }
        .max-btn { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); border: 1px solid #e2e8f0; background: #f8fafc; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; line-height: 1; }
        .max-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 600px) {
          .row { flex-direction: column; align-items: stretch; gap: 8px; }
          .sel { width: 100%; }
          .inp-wrap { width: 100%; }
          .inp { width: 100%; padding-right: 56px; }
          .max-btn { right: 8px; }
        }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}
