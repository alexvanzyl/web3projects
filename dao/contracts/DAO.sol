// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "hardhat/console.sol";

contract DAO {
    struct Proposal {
        uint256 id;
        string name;
        uint256 amount;
        address payable recipient;
        uint256 votes;
        uint256 end;
        bool executed;
    }

    mapping(address => bool) public investors;
    mapping(address => uint256) public shares;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => bool)) public votes;
    uint256 public totalShares;
    uint256 public availableFunds;
    uint256 public contributionEnd;
    uint256 public nextProposalId;
    uint256 public voteTime;
    uint256 public quorum;
    address public admin;

    modifier onlyInvestors() {
        require(investors[msg.sender] == true, "only investors");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    constructor(
        uint256 _contributionTime,
        uint256 _voteTime,
        uint256 _quorum
    ) {
        require(
            _quorum > 0 && _quorum < 100,
            "quorum must be between 0 and 100"
        );
        contributionEnd = block.timestamp + _contributionTime;
        voteTime = _voteTime;
        quorum = _quorum;
        admin = msg.sender;
    }

    function contribute() external payable {
        require(
            block.timestamp < contributionEnd,
            "cannot contribute after contributionEnd"
        );
        investors[msg.sender] = true;
        shares[msg.sender] += msg.value;
        totalShares += msg.value;
        availableFunds += msg.value;
    }

    function redeemShare(uint256 _amount) external {
        require(shares[msg.sender] >= _amount, "not enough shares");

        shares[msg.sender] -= _amount;

        _transferEther(_amount, payable(msg.sender));
    }

    function transferShare(uint256 _amount, address _to) external {
        require(shares[msg.sender] >= _amount, "not enough shares");

        shares[msg.sender] -= _amount;
        shares[_to] += _amount;
        investors[_to] = true;
    }

    function createProposal(
        string memory _name,
        uint256 _amount,
        address payable _recipient
    ) external onlyInvestors {
        require(availableFunds >= _amount, "amount to big");

        proposals[nextProposalId] = Proposal(
            nextProposalId,
            _name,
            _amount,
            _recipient,
            0,
            block.timestamp + voteTime,
            false
        );
        availableFunds -= _amount;
        nextProposalId++;
    }

    function vote(uint256 _proposalId) external onlyInvestors {
        Proposal storage proposal = proposals[_proposalId];
        require(votes[msg.sender][_proposalId] == false, "can only vote once");
        require(
            block.timestamp < proposal.end,
            "can only vote until proposal end"
        );

        votes[msg.sender][_proposalId] = true;
        proposal.votes += shares[msg.sender];
    }

    function executeProposal(uint256 _proposalId) external onlyAdmin {
        Proposal storage proposal = proposals[_proposalId];
        require(
            block.timestamp >= proposal.end,
            "cannot execute proposal before end date"
        );
        require(proposal.executed == false, "proposal already executed");
        require(
            (proposal.votes * 100) / totalShares >= quorum,
            "not enough votes to execute proposal"
        );

        proposal.executed = true;
        _transferEther(proposal.amount, proposal.recipient);
    }

    function withdrawEther(uint256 _amount, address payable _to)
        external
        onlyAdmin
    {
        _transferEther(_amount, _to);
    }

    function _transferEther(uint256 _amount, address payable _to) internal {
        require(_amount <= availableFunds, "not enough availableFunds");
        availableFunds -= _amount;
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "transfer failed");
    }

    receive() external payable {
        availableFunds += msg.value;
    }
}
