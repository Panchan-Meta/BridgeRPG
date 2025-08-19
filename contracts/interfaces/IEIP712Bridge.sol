// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEIP712Bridge {
    function nonces(address) external view returns (uint256);
}