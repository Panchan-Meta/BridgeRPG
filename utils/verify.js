import { utils } from "ethers";

/**
 * EIP-712 署名を検証して、期待されるリレイヤーと一致するかチェック
 *
 * @param {Object} params
 * @param {string} params.user - 対象ユーザーのアドレス
 * @param {string | BigNumber} params.amount - 署名対象の金額（uint256）
 * @param {number} params.nonce - ユーザーのnonce
 * @param {string} params.signature - EIP-712 署名
 * @param {string} params.verifyingContract - Bridgeコントラクトのアドレス
 * @param {number} params.chainId - チェーンID（PGirlsChain）
 * @param {string} params.expectedSigner - 想定するリレイヤーアドレス
 *
 * @returns {Object} { valid: boolean, recovered: string, digest: string, domainSeparator: string }
 */
export function verifyBridgeSignature({
  user,
  amount,
  nonce,
  signature,
  verifyingContract,
  chainId,
  expectedSigner,
}) {
  // 型定義
  const domain = {
    name: "PGirlsBridge",
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
    amount,
    nonce,
  };

  // digest（EIP-712 メッセージハッシュ）生成
  const digest = utils._TypedDataEncoder.hash(domain, types, value);

  // domain separator（optional, デバッグ用）
  const domainSeparator = utils._TypedDataEncoder.hashDomain(domain);

  // 署名者を復元
  const recovered = utils.recoverAddress(digest, signature);

  return {
    valid: recovered.toLowerCase() === expectedSigner.toLowerCase(),
    recovered,
    digest,
    domainSeparator,
  };
}
