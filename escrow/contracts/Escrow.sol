// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract Escrow {
    address public payer;
    address payable public payee;
    address public holder;
    uint256 public amount;

    constructor(
        address _payer,
        address payable _payee,
        uint256 _amount
    ) {
        payer = _payer;
        payee = _payee;
        holder = msg.sender;
        amount = _amount;
    }

    function deposit() public payable {
        require(msg.sender == payer, "sender must be the payer");
        require(
            address(this).balance <= amount,
            "deposit must be less or equal to amount"
        );
    }

    function release() public {
        require(msg.sender == holder, "only holder can release funds");
        require(address(this).balance == amount, "escrow must be fully funded");
        (bool success, ) = payee.call{value: amount}("");
        require(success, "transfer failed");
    }

    function balanceOf() public view returns (uint256) {
        return address(this).balance;
    }
}
