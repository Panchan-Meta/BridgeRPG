// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBurnableERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function burn(uint256 amount) external;                   // ✅ burn 自分のトークン
    function burnFrom(address from, uint256 amount) external; // ✅ burn 他人のトークン（allowance 必要）
    function mint(address to, uint256 amount) external;       // ✅ mint 新規発行（ブリッジ用）
}