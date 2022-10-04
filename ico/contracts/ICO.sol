// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import {ERC20Token} from "./ERC20Token.sol";

contract ICO {
    struct Sale {
        address investor;
        uint256 quantity;
    }
    Sale[] public sales;
    address public token;
    address public admin;
    uint256 public end;
    uint256 public price;
    uint256 public availableTokens;
    uint256 public minPurchase;
    uint256 public maxPurchase;
    bool public released;
    mapping(address => bool) public investors;

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier onlyInvestors() {
        require(investors[msg.sender] == true, "only investors");
        _;
    }

    modifier icoNotActive() {
        require(end == 0, "ICO should not be active");
        _;
    }

    modifier icoActive() {
        require(
            end > 0 && block.timestamp < end && availableTokens > 0,
            "ICO must be active"
        );
        _;
    }

    modifier icoEnded() {
        require(
            end > 0 && (block.timestamp >= end || availableTokens > 0),
            "ICO must have ended"
        );
        _;
    }

    modifier tokensNotReleased() {
        require(released == false, "tokens must not have been released");
        _;
    }

    modifier tokensReleased() {
        require(released == true, "tokens must have been released");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply
    ) {
        token = address(
            new ERC20Token(_name, _symbol, _decimals, _totalSupply)
        );
        admin = msg.sender;
    }

    function start(
        uint256 _duration,
        uint256 _price,
        uint256 _availableTokens,
        uint256 _minPurchase,
        uint256 _maxPurchase
    ) external onlyAdmin icoNotActive {
        require(_duration > 0, "duration should be > 0");
        uint256 totalSupply = ERC20Token(token).totalSupply();
        require(
            _availableTokens > 0 && _availableTokens <= totalSupply,
            "_availableTokens should be > 0 and <= totalSupply"
        );
        require(_minPurchase > 0, "_minPurchase should be > 0");
        require(
            _maxPurchase > 0 && _maxPurchase <= _availableTokens,
            "_maxPurchase should be > 0 and <= _availableTokens"
        );

        end = block.timestamp + _duration;
        price = _price;
        availableTokens = _availableTokens;
        minPurchase = _minPurchase;
        maxPurchase = _maxPurchase;
    }

    function whitelist(address _investor) external onlyAdmin {
        investors[_investor] = true;
    }

    function buy() external payable onlyInvestors icoActive {
        require(msg.value % price == 0, "have to send a multiple of price");
        require(
            msg.value >= minPurchase && msg.value <= maxPurchase,
            "have to send between minPurchase and maxPurchase"
        );
        uint256 quantity = price * msg.value;
        require(quantity <= availableTokens, "not enough tokens left for sale");
        sales.push(Sale(msg.sender, quantity));
        availableTokens -= quantity;
    }

    function release() external onlyAdmin icoEnded tokensNotReleased {
        ERC20Token tokenInstance = ERC20Token(token);
        for (uint256 i = 0; i < sales.length; i++) {
            Sale storage sale = sales[i];
            tokenInstance.transfer(sale.investor, sale.quantity);
        }
        released = true;
    }

    function withdraw(address payable _to, uint256 amount)
        external
        onlyAdmin
        icoEnded
        tokensReleased
    {
        (bool success, ) = _to.call{value: amount}("");
        require(success, "transfer failed");
    }
}
