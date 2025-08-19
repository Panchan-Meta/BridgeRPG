// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract pGCoin is ERC20, ERC20Permit, Ownable {
    mapping(address => bool) private minters;

    modifier onlyMinter() {
        require(minters[msg.sender], "Not authorized minter");
        _;
    }

    constructor(uint256 initialSupply, address initialMinter)
        ERC20("pGCoin", "PGC")
        ERC20Permit("pGCoin")
    {
        _mint(msg.sender, initialSupply);
        minters[initialMinter] = true;
    }

    /// @notice Mint tokens to user (only bridge or authorized minter)
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    /// @notice Burn tokens from user (must have allowance and balance)
    function burnFrom(address from, uint256 amount) external onlyMinter {
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");

        _approve(from, msg.sender, currentAllowance - amount);
        _burn(from, amount);
    }

    /// @notice Grant or revoke mint/burn permissions
    function setMinter(address minter, bool status) external onlyOwner {
        minters[minter] = status;
    }

    /// @notice Check if address is minter
    function isMinter(address account) external view returns (bool) {
        return minters[account];
    }
}
