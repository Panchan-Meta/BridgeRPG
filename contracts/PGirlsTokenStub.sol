// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract PGirlsTokenStub is ERC20 {
    constructor() ERC20("PGirls", "PGIRLS") {
        // No minting
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}