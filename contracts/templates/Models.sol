// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "../kernel/Kernel.sol";
import "../apps/AdminController/AdminController.sol";
import "../apps/ERC721Properties/ERC721Properties.sol";
import "../apps/ERC721Sale/ERC721OpenSale.sol";
import "../apps/ERC721Sale/ERC721WhitelistSale.sol";
import "../apps/ERC721Properties/ERC721Properties.sol";

library Models {
    enum AdditionalModules {
        OpenSale,
        WhitelistSale
    }

    struct DeploymentSettings {
        AdminSettings adminSettings;
        NFTSettings nftSettings;
        SaleSettings openSaleSettings;
        SaleSettings whiteListSaleSettings;
    }

    struct AdminSettings {
        address[] admins;
        address releaseManager;
        address creator;
    }

    struct NFTSettings {
        address openseaOwner;
        string url;
        string name;
        string symbol;
        Attribute[] attributes;
    }

    struct Attribute {
        bytes32 tierId;
        string attrName;
        bytes32 value;
    }

    struct SaleSettings {
        bytes32[] tiersValues;
        uint256[] tiersPrices;
        uint64 claimLimit;
        address tokenSaleAddress;
    }
}
