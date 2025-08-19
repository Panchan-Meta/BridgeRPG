// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract PGirlsToken is ERC20, Ownable, ERC20Permit {
    mapping(address => bool) public isMinter;

    event Minted(address indexed minter, address indexed to, uint256 amount);
    event Burned(address indexed burner, address indexed from, uint256 amount);
    event MinterUpdated(address indexed minter, bool status);

    modifier onlyMinter() {
        require(isMinter[msg.sender], "Not authorized minter");
        _;
    }

    constructor(uint256 initialSupply, address initialRecipient)
        ERC20("PGirls", "PGIRLS")
        ERC20Permit("PGirls")
    {
        require(initialRecipient != address(0), "Invalid recipient");

        if (initialSupply > 0) {
            _mint(initialRecipient, initialSupply);
        }

        _transferOwnership(initialRecipient); // ✅ 所有権を初期受取人に委譲（Bridge想定）
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function setMinter(address minter, bool status) external onlyOwner {
        isMinter[minter] = status;
        emit MinterUpdated(minter, status);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        require(amount > 0, "Amount must be > 0");
        _mint(to, amount);
        emit Minted(msg.sender, to, amount);
    }

    function burn(uint256 amount) external onlyMinter {
        require(amount > 0, "Amount must be > 0");
        _burn(msg.sender, amount);
        emit Burned(msg.sender, msg.sender, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyMinter {
        require(amount > 0, "Amount must be > 0");

        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");

        _approve(from, msg.sender, currentAllowance - amount);
        _burn(from, amount);
        emit Burned(msg.sender, from, amount);
    }
    
	function burnHeld(uint256 amount) external onlyMinter {
	    require(amount > 0, "Amount must be > 0");
	    _burn(address(this), amount);
	    emit Burned(msg.sender, address(this), amount);
	}

}
