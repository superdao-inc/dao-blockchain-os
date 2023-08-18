// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

interface IOracle {
    function getTradePrice(address tokenSalePrice, address tokenBuyPrice) external view returns (uint256 price);
}
