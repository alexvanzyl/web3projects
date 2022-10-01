// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract MultiSig {
    address[] public approvers;
    uint256 public quorum;
    uint256 nextId;
    mapping(uint256 => Transfer) public transfers;
    mapping(address => mapping(uint256 => bool)) approvals;

    struct Transfer {
        uint256 id;
        uint256 amount;
        address payable to;
        uint256 approvals;
        bool sent;
    }

    modifier onlyApprover() {
        bool allowed = false;
        for (uint256 i = 0; i < approvers.length; i++) {
            if (approvers[i] == msg.sender) {
                allowed = true;
            }
        }
        require(allowed == true, "only approver allowed");
        _;
    }

    constructor(address[] memory _approvers, uint256 _quorum) payable {
        approvers = _approvers;
        quorum = _quorum;
    }

    function createTransfer(uint256 _amount, address payable _to)
        external
        onlyApprover
    {
        transfers[nextId] = Transfer(nextId, _amount, _to, 0, false);
        nextId++;
    }

    function sendTransfer(uint256 _id) external onlyApprover {
        require(transfers[_id].sent == false, "transfer already sent");

        if (approvals[msg.sender][_id] == false) {
            approvals[msg.sender][_id] = true;
            transfers[_id].approvals++;
        }

        if (transfers[_id].approvals >= quorum) {
            transfers[_id].sent = true;
            address payable to = transfers[_id].to;
            uint256 amount = transfers[_id].amount;

            (bool success, ) = to.call{value: amount}("");
            require(success, "tranfer failed");
            return;
        }
    }
}
