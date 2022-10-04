// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Token is ERC20 {
    uint8 setDecimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) {
        setDecimals = _decimals;
        _mint(msg.sender, _initialSupply);
    }

    function decimals() public view override returns (uint8) {
        return setDecimals;
    }
}
