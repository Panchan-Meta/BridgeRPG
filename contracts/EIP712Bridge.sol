// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPGirlsToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function transferOwnership(address newOwner) external;
    function setMinter(address minter, bool enabled) external;
    function burnHeld(uint256 amount) external;
}

contract EIP712Bridge is Ownable {
    IPGirlsToken public pgirlsToken;
    IERC20 public pgirlsNativeToken;
    address public payoutAddress;
    uint256 public nativeTokenAmount = 1 ether;

    event BridgedToPGirls(address indexed user, uint256 ethAmount, uint256 pgirlsAmount);
    event BridgedToETH(address indexed user, uint256 pgirlsAmount, uint256 ethAmount);

    // PGirls ↔ ETH の交換レート
    // 例: 1 ETH = 55.55 PGirls → numerator = 1000, denominator = 18
    uint256 public rateNumerator = 1000;
    uint256 public rateDenominator = 18;

    constructor() {}

    receive() external payable {
        // 受信時にログ出力
        emit Received(msg.sender, msg.value);
    }

    event Received(address indexed sender, uint256 amount);

    function setPGirlsToken(address _pgirlsToken) external onlyOwner {
        pgirlsToken = IPGirlsToken(_pgirlsToken);
    }

    function setPGirlsNativeToken(address _pgirlsNativeToken) external onlyOwner {
        pgirlsNativeToken = IERC20(_pgirlsNativeToken);
    }

    function setPayoutAddress(address _payoutAddress) external onlyOwner {
        payoutAddress = _payoutAddress;
    }

    function setNativeTokenAmount(uint256 amount) external onlyOwner {
        require(amount > 0, "Invalid amount");
        nativeTokenAmount = amount;
    }

    function _payoutAddress() internal view returns (address) {
        address addr = payoutAddress;
        return addr == address(0) ? owner() : addr;
    }

    function setRate(uint256 numerator, uint256 denominator) external onlyOwner {
        require(denominator > 0, "Invalid denominator");
        rateNumerator = numerator;
        rateDenominator = denominator;
    }

    /**
     * Ethereum → PGirls
     * ユーザーがBridgeにETHを送金 → PGirlsをmint
     */
    function bridgeToPGirls(address user, uint256 ethAmount) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(ethAmount > 0, "Invalid amount");

        require(address(pgirlsToken) != address(0), "PGirls token not set");
        require(address(pgirlsNativeToken) != address(0), "Native token not set");

        uint256 pgirlsAmount = (ethAmount * rateNumerator) / rateDenominator;

        address source = _payoutAddress();

        require(pgirlsToken.transferFrom(source, user, pgirlsAmount), "PGirls transfer failed");
        require(pgirlsNativeToken.transferFrom(source, user, nativeTokenAmount), "Native transfer failed");

        emit BridgedToPGirls(user, ethAmount, pgirlsAmount);
    }

    /**
     * PGirls → Ethereum
     * ユーザーからPGirlsをBurn → ブリッジがETH送金
     */
	function bridgeToETH(uint256 pgirlsAmount) external {
	    require(pgirlsAmount > 0, "Invalid amount");

	    address user = msg.sender;

	    // 🔥 Burn directly from the user (requires allowance)
	    pgirlsToken.burnFrom(user, pgirlsAmount); // ← user指定！

	    uint256 ethAmount = (pgirlsAmount * rateDenominator) / rateNumerator;
	    //require(address(this).balance >= ethAmount, "Insufficient ETH in bridge");

	    //payable(user).transfer(ethAmount);

	    emit BridgedToETH(user, pgirlsAmount, ethAmount);
	}


	// Bridgeが自分自身をミンターに登録
	function setSelfAsMinter() external onlyOwner {
	    pgirlsToken.setMinter(address(this), true);
	}
	
	/**
	* ブリッジコントラクトにあるETHをオーナーが引き出す
	*/
	function withdrawETH(address payable to, uint256 amount) external onlyOwner {
    	require(to != address(0), "Invalid recipient");
    	require(amount <= address(this).balance, "Insufficient ETH balance");
    	to.transfer(amount);
	}
}
