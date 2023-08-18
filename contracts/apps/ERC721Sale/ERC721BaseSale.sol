// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "../App.sol";
import "../ERC721Properties/ERC721Properties.sol";
import "../../libraries/Exceptions.sol";
import "../../libraries/AppsIds.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

contract ERC721BaseSale is App {
    using AddressUpgradeable for address payable;
    uint8 public immutable CONTROLLER = _initNextRole();

    string private constant PROPERTY_TIER = "TIER";
    string private constant ATTRIBUTE_MAX_AMOUNT = "MAX_AMOUNT";
    string private constant ATTRIBUTE_TOTAL_AMOUNT = "TOTAL_AMOUNT";

    mapping(bytes32 => uint256) public tierPrices;

    bool public isActive;
    uint64 public claimLimit;
    uint64 public totalClaimsLimit;
    uint64 public totalClaimed;
    mapping(address => uint256) public claims;
    mapping(bytes32 => uint256) public tierPerWalletLimit;
    mapping(address => mapping(bytes32 => uint256)) public tierPerWalletClaimed;
    uint256[95] private __gap;

    event OnBuy(
        address buyer,
        address appAddress,
        bytes32 tierValue,
        uint256 cost,
        address buyToken,
        string saleType,
        string semver
    );
    event SetPaymentPolicy(bytes32[] tierValues, uint256[] tierPrices_);
    event SetClaimLimit(uint64 claimLimit);
    event SetActive(bool isActive);
    event SetTotalClaimLimit(uint64 totalClaims);
    event SetTierPerWalletLimits(bytes32[] tierValues, uint256[] tierLimits);

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    function setPaymentPolicy(bytes32[] calldata tierValues, uint256[] calldata tierPrices_)
        external
        requirePermission(CONTROLLER)
    {
        require(tierValues.length == tierPrices_.length, Exceptions.VALIDATION_ERROR);

        for (uint256 i; i != tierValues.length; ++i) {
            tierPrices[tierValues[i]] = tierPrices_[i];
        }
        emit SetPaymentPolicy(tierValues, tierPrices_);
    }

    function setClaimLimit(uint64 claimLimit_) external requirePermission(CONTROLLER) {
        claimLimit = claimLimit_;
        emit SetClaimLimit(claimLimit);
    }

    function setTierPerWalletLimits(bytes32[] calldata tierValues, uint256[] calldata tierLimits)
        external
        requirePermission(CONTROLLER)
    {
        require(tierValues.length == tierLimits.length, Exceptions.VALIDATION_ERROR);

        for (uint256 i; i != tierValues.length; ++i) {
            tierPerWalletLimit[tierValues[i]] = tierLimits[i];
        }
        emit SetTierPerWalletLimits(tierValues, tierLimits);
    }

    function setTotalClaimsLimits(uint64 totalClaims) external requirePermission(CONTROLLER) {
        totalClaimsLimit = totalClaims;
        emit SetTotalClaimLimit(totalClaims);
    }

    function _claim(bytes32 tierValue) internal {
        if (totalClaimsLimit != 0) {
            require(totalClaimsLimit > totalClaimed, Exceptions.BUY_LIMIT_ERROR);
            totalClaimed++;
        }
        if (claimLimit != 0) {
            require(claimLimit > claims[_msgSender()], Exceptions.BUY_LIMIT_ERROR);
        }
        if (tierPerWalletLimit[tierValue] != 0) {
            require(
                tierPerWalletLimit[tierValue] > tierPerWalletClaimed[_msgSender()][tierValue],
                Exceptions.BUY_LIMIT_ERROR
            );
            tierPerWalletClaimed[_msgSender()][tierValue]++;
        }
        claims[_msgSender()]++;
    }

    function _transferToTreasury() internal {
        address wallet = kernel.getTreasury();
        require(wallet != address(0x00), Exceptions.NO_TREASURY_ADDRESS);
        payable(wallet).sendValue(msg.value);
    }

    function setActive(bool isActive_) external requirePermission(CONTROLLER) {
        isActive = isActive_;
        emit SetActive(isActive);
    }

    function _afterBuy(
        address buyer,
        address appAddress,
        bytes32 tierValue,
        uint256 cost,
        address buyToken,
        string memory saleType,
        string memory semver
    ) internal {
        emit OnBuy(buyer, appAddress, tierValue, cost, buyToken, saleType, semver);
    }

    function getLeftClaimsForTier(bytes32 tierValue) public view returns (uint256) {
        uint256 available = type(uint256).max;
        address appAddress = kernel.getAppAddress(AppsIds.ERC721);

        if (totalClaimsLimit != 0) {
            if (totalClaimsLimit > totalClaimed) {
                available = totalClaimsLimit - totalClaimed;
            } else {
                return 0;
            }
        }

        uint256 tierLimit = uint256(
            ERC721Properties(appAddress).getAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_MAX_AMOUNT)
        );
        if (tierLimit != 0) {
            uint256 claimed = uint256(
                ERC721Properties(appAddress).getAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TOTAL_AMOUNT)
            );
            if (tierLimit > claimed) {
                uint256 rest = tierLimit - claimed;
                available = rest < available ? rest : available;
            } else {
                return 0;
            }
        }

        return available;
    }

    function getLeftClaimsForWallet(address wallet, bytes32 tierValue) public view returns (uint256) {
        uint256 available = getLeftClaimsForTier(tierValue);
        uint256 perWalletLimit = tierPerWalletLimit[tierValue];
        if (perWalletLimit != 0) {
            uint256 claimed = tierPerWalletClaimed[wallet][tierValue];
            uint256 rest = perWalletLimit - claimed;
            available = rest < available ? rest : available;
        }

        return available;
    }
}
