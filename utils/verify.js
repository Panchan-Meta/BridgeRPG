import { utils } from "ethers";

/**
 * EIP-712 ���������؂��āA���҂���郊���C���[�ƈ�v���邩�`�F�b�N
 *
 * @param {Object} params
 * @param {string} params.user - �Ώۃ��[�U�[�̃A�h���X
 * @param {string | BigNumber} params.amount - �����Ώۂ̋��z�iuint256�j
 * @param {number} params.nonce - ���[�U�[��nonce
 * @param {string} params.signature - EIP-712 ����
 * @param {string} params.verifyingContract - Bridge�R���g���N�g�̃A�h���X
 * @param {number} params.chainId - �`�F�[��ID�iPGirlsChain�j
 * @param {string} params.expectedSigner - �z�肷�郊���C���[�A�h���X
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
  // �^��`
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

  // digest�iEIP-712 ���b�Z�[�W�n�b�V���j����
  const digest = utils._TypedDataEncoder.hash(domain, types, value);

  // domain separator�ioptional, �f�o�b�O�p�j
  const domainSeparator = utils._TypedDataEncoder.hashDomain(domain);

  // �����҂𕜌�
  const recovered = utils.recoverAddress(digest, signature);

  return {
    valid: recovered.toLowerCase() === expectedSigner.toLowerCase(),
    recovered,
    digest,
    domainSeparator,
  };
}
