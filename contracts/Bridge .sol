// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IBurnableERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Bridge is Ownable {
    using ECDSA for bytes32;

    IBurnableERC20 public pgirls;
    IBurnableERC20 public pgcoin;
    address public relayer;

    mapping(address => uint256) public nonces;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event BridgedToPGirlsChain(address indexed user, uint256 amount);
    event BridgedToEthereum(address indexed user, uint256 amount);

    constructor(address _pgirls, address _pgcoin, address _relayer) {
        pgirls = IBurnableERC20(_pgirls);
        pgcoin = IBurnableERC20(_pgcoin);
        relayer = _relayer;
    }

    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }

    // ⚠️ ETH → PGirls: ETHを預かる（mintは外部で）
    function deposit() external payable {
        require(msg.value > 0, "No ETH sent");
        emit Deposited(msg.sender, msg.value);
    }

    // 🔁 PGirls → ETH: PGirls をバーンして ETH を受け取るリクエスト
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        pgirls.burnFrom(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // 🔁 PGirls → pGCoin: PGirls をバーンして PGirlsChain 側に mint リクエスト
    function bridgeToPGirlsChain(uint256 amount, bytes calldata signature) external {
        require(amount > 0, "Amount must be > 0");

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                getDomainSeparator(),
                keccak256(abi.encode(
                    keccak256("Bridge(address user,uint256 amount,uint256 nonce)"),
                    msg.sender,
                    amount,
                    nonces[msg.sender]
                ))
            )
        );

        address recovered = digest.recover(signature);
        require(recovered == relayer, "Invalid relayer signature");

        pgirls.burnFrom(msg.sender, amount);
        emit BridgedToPGirlsChain(msg.sender, amount);

        nonces[msg.sender]++;
    }

    // 🔁 pGCoin → PGirls: PGirlsChain でバーン済みの pGCoin を受けて PGirls mint リクエスト（外部mint）
    function bridgeToEthereum(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        pgcoin.burnFrom(msg.sender, amount);
        emit BridgedToEthereum(msg.sender, amount);
    }

    function getDomainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("PGirlsBridge")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }
}