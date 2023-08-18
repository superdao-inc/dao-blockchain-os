// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolActions.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/libraries/FixedPoint96.sol";
import "../apps/UpgradeableApp.sol";
import "../libraries/Exceptions.sol";
import "../libraries/Semver.sol";
import "../libraries/UniswapMath.sol";
import "./IOracle.sol";

/**
 * @title UniswapV3Oracle.sol
 * @author SuperdaoTeam
 * @dev Oracle performs integration with UniswapV3 pools for price erc-20 tokens.
 */
contract UniswapV3Oracle is
    UpgradeableApp,
    Initializable,
    OwnableUpgradeable,
    IOracle,
    __with_semver(uint8(1), uint8(0), uint8(4))
{
    uint24 private constant FEE_100 = 100;
    uint24 private constant FEE_500 = 500;
    uint24 private constant FEE_3000 = 3000;
    uint24 private constant FEE_NUM = 3;

    address public immutable nativeTokenWrapperAddress;
    address public immutable nativeTokenAddress;

    IUniswapV3Factory public uniswapFactory;
    uint32 public twapInterval;
    address[] public whitelistTokens;
    event Upgrade(address code);
    event SetTwapInterval(uint32 twapInterval);

    constructor(address nativeTokenWrapperAddress_, address nativeTokenAddress_) {
        nativeTokenWrapperAddress = nativeTokenWrapperAddress_;
        nativeTokenAddress = nativeTokenAddress_;
    }

    function initialize(
        IUniswapV3Factory uniswapFactory_,
        uint32 twapInterval_,
        address owner_
    ) external initializer {
        uniswapFactory = uniswapFactory_;
        twapInterval = twapInterval_;
        _transferOwnership(owner_);
    }

    /**
     * @dev Update via new address
     *
     */
    function upgrade(address appCode) external onlyOwner {
        _getImplementationSlot().value = appCode;

        emit Upgrade(appCode);
    }

    /**
     * @dev Get implementation
     *
     */
    function implementation() external view returns (address) {
        return _getImplementationSlot().value;
    }

    function setFactoryAddress(IUniswapV3Factory uniswapFactory_) external onlyOwner {
        uniswapFactory = uniswapFactory_;
    }

    function setTwapInterval(uint32 twapInterval_) external onlyOwner {
        require(twapInterval_ < (1 << (31 - 1)), Exceptions.VALIDATION_ERROR);
        twapInterval = twapInterval_;
        emit SetTwapInterval(twapInterval_);
    }

    function setWhitelistTokenAddress(address[] calldata tokenAddress_) external onlyOwner {
        whitelistTokens = tokenAddress_;
    }

    function isInWhitelistTokenAddress(address tokenAddress_) public view returns (bool) {
        for (uint256 i = 0; i < whitelistTokens.length; i++) {
            if (whitelistTokens[i] == tokenAddress_) return true;
        }
        return false;
    }

    /**
     * @dev Get price in buy token with decimals for one sale token. E.g.
     */
    function getTradePrice(address tokenSalePrice, address tokenBuyPrice) external view returns (uint256 price) {
        if (tokenSalePrice == tokenBuyPrice) {
            require(
                isInWhitelistTokenAddress(tokenSalePrice) && isInWhitelistTokenAddress(tokenSalePrice),
                Exceptions.VALIDATION_ERROR
            );
            return 10**_getDecimals(tokenSalePrice);
        }
        address poolAddress = _getTargetPool(tokenSalePrice, tokenBuyPrice);
        return _getTradePrice(poolAddress, tokenBuyPrice);
    }

    function _getTargetPool(address tokenSalePrice, address tokenBuyPrice) private view returns (address poolAddress) {
        address tempPool;
        uint256 poolLiquidity;
        uint256 tempLiquidity;
        for (uint24 i = 0; i < FEE_NUM; i++) {
            tempPool = uniswapFactory.getPool(tokenSalePrice, tokenBuyPrice, _fee(i));
            if (tempPool == address(0)) continue;
            tempLiquidity = IUniswapV3Pool(tempPool).liquidity();
            if (tempLiquidity > poolLiquidity) {
                poolLiquidity = tempLiquidity;
                poolAddress = tempPool;
            }
        }
        require(poolAddress != address(0) && poolAddress.code.length > 0, Exceptions.LIQUIDITY_POOL_NOT_FOUND);
    }

    function _getTradePrice(address uniswapV3Pool, address tokenBuyPrice) private view returns (uint256 price) {
        IUniswapV3Pool pool = IUniswapV3Pool(uniswapV3Pool);

        uint160 sqrtPriceX96 = _getSqrtPriceX96(pool, twapInterval);
        uint256 priceX96 = UniswapMath.mulDiv(sqrtPriceX96, sqrtPriceX96, FixedPoint96.Q96);

        address token0 = pool.token0();
        if (token0 == tokenBuyPrice) {
            address token1 = pool.token1();
            price = (((10**_getDecimals(token1)) << 96) / priceX96);
        } else {
            price = ((10**_getDecimals(token0)) * priceX96) >> 96;
        }
    }

    function _getSqrtPriceX96(IUniswapV3Pool pool, uint32 twapInterval_) private view returns (uint160 sqrtPriceX96) {
        if (twapInterval_ == 0) {
            // return the current price if twapInterval == 0
            (sqrtPriceX96, , , , , , ) = pool.slot0();
        } else {
            uint32[] memory secondsAgos = new uint32[](2);
            secondsAgos[0] = twapInterval_; // from (before)
            secondsAgos[1] = 0; // to (now)

            (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);

            sqrtPriceX96 = UniswapMath.getSqrtRatioAtTick(
                int24((tickCumulatives[1] - tickCumulatives[0]) / int32(twapInterval_))
            );
        }
    }

    function _getDecimals(address token) private view returns (uint8 decimals) {
        decimals = ERC20(token).decimals();
    }

    function _fee(uint256 i) private pure returns (uint24) {
        uint24[3] memory _fees = [FEE_100, FEE_500, FEE_3000];
        return _fees[i];
    }

    function increasePoolHistory(
        address tokenSalePrice,
        address tokenBuyPrice,
        uint16 size
    ) external {
        address poolAddress = _getTargetPool(tokenSalePrice, tokenBuyPrice);
        IUniswapV3PoolActions(poolAddress).increaseObservationCardinalityNext(size);
    }
}
