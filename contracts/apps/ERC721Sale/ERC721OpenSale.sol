// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../oracle/UniswapV3Oracle.sol";
import "./ERC721BaseSale.sol";
import "../../libraries/Exceptions.sol";
import "../../libraries/AppsIds.sol";
import "../ERC721Properties/ERC721Properties.sol";
import {__with_semver} from "../../libraries/Semver.sol";

contract ERC721OpenSale is ERC721BaseSale, __with_semver(uint8(1), uint8(2), uint8(1)) {
    address private immutable _oracleAddress;
    address private immutable _nativeTokenAddress;
    address private immutable _nativeTokenWrapperAddress;
    using SafeERC20 for IERC20;

    // stored in DAI
    address public tokenSaleAddress;

    uint8 private _tokenSaleDecimals;

    event TokenSaleAddress(address tokenSaleAddress_);

    constructor(address trustedForwarder, address oracleAddress_) ERC721BaseSale(trustedForwarder) {
        _oracleAddress = oracleAddress_;
        _nativeTokenAddress = UniswapV3Oracle(_oracleAddress).nativeTokenAddress();
        _nativeTokenWrapperAddress = UniswapV3Oracle(_oracleAddress).nativeTokenWrapperAddress();
    }

    function initialize(IKernel _kernel) external initializer {
        __App_init(_kernel);
    }

    function getPrice(address tokenAddress, bytes32 tierValue)
        public
        view
        returns (uint256 tradePrice, uint256 costInBuyTokens)
    {
        uint256 cost = tierPrices[tierValue];
        require(cost != 0, Exceptions.NOT_FOUND_PRICE_FOR_TIER);
        require(tokenSaleAddress != address(0x00), Exceptions.BASIC_TOKEN_ADDRESS_NOT_SET);

        uint256 price = UniswapV3Oracle(_oracleAddress).getTradePrice(
            _nativeTokenAddress == tokenSaleAddress ? _nativeTokenWrapperAddress : tokenSaleAddress,
            _nativeTokenAddress == tokenAddress ? _nativeTokenWrapperAddress : tokenAddress
        );
        return (price, (cost * price) / (10**_tokenSaleDecimals));
    }

    function getPriceInNativeTokens(bytes32 tierValue) public view returns (uint256 costInBuyTokens) {
        (, costInBuyTokens) = getPrice(_nativeTokenAddress, tierValue);
        return costInBuyTokens;
    }

    function buy(
        address to,
        bytes32 tierValue,
        address tokenBuyAddress
    ) external payable {
        require(isActive, Exceptions.UNAVAILABLE_ERROR);
        uint256 costInBuyTokens;
        address appAddress = kernel.getAppAddress(AppsIds.ERC721);
        if (msg.value > 0) {
            (, costInBuyTokens) = getPrice(_nativeTokenWrapperAddress, tierValue);
            require(costInBuyTokens != 0, Exceptions.VALIDATION_ERROR);

            _claim(tierValue);
            require(msg.value >= costInBuyTokens, Exceptions.VALIDATION_ERROR);
            _transferToTreasury();
            ERC721Properties(appAddress).mint(to, tierValue);
            _afterBuy(to, appAddress, tierValue, costInBuyTokens, address(0), "ERC20_SALE", __semver());
        } else {
            (, costInBuyTokens) = getPrice(tokenBuyAddress, tierValue);
            require(costInBuyTokens != 0, Exceptions.VALIDATION_ERROR);

            _claim(tierValue);
            _tokenTransferFromToTreasury(to, tokenBuyAddress, costInBuyTokens);
            ERC721Properties(appAddress).mint(to, tierValue);
            _afterBuy(to, appAddress, tierValue, costInBuyTokens, tokenBuyAddress, "ERC20_SALE", __semver());
        }
    }

    function setTokenSaleAddress(address tokenSaleAddress_) external requirePermission(CONTROLLER) {
        require(tokenSaleAddress_ != address(0x00) && tokenSaleAddress_.code.length > 0, Exceptions.NULL_TOKEN_ADDRESS);
        tokenSaleAddress = tokenSaleAddress_;
        _tokenSaleDecimals = ERC20(tokenSaleAddress).decimals();
        emit TokenSaleAddress(tokenSaleAddress_);
    }

    function _tokenTransferFromToTreasury(
        address from,
        address tokenBuyAddress,
        uint256 costInBuyTokens_
    ) internal {
        address treasury = kernel.getTreasury();
        require(treasury != address(0x00), Exceptions.NO_TREASURY_ADDRESS);

        IERC20 tokenBuy = IERC20(tokenBuyAddress);

        uint256 currentAllowance = tokenBuy.allowance(from, address(this));
        require(currentAllowance >= costInBuyTokens_, Exceptions.INSUFFICIENT_ALLOWANCE);

        tokenBuy.safeTransferFrom(from, treasury, costInBuyTokens_);
    }
}
