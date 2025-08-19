// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBurnableERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function burnFrom(address account, uint256 amount) external;
}
