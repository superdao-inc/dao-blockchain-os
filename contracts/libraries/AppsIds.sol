// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

library AppsIds {
    bytes32 constant KERNEL = keccak256(abi.encodePacked("KERNEL"));
    bytes32 constant SUDO = keccak256(abi.encodePacked("SUDO"));
    bytes32 constant ERC721 = keccak256(abi.encodePacked("ERC721"));
    bytes32 constant ADMIN_CONTROLLER = keccak256(abi.encodePacked("ADMIN")); //TODO: renamde admin to ADMIN_CONTROLLER
    bytes32 constant ERC721_OPEN_SALE = keccak256(abi.encodePacked("ERC721_OPEN_SALE"));
    bytes32 constant ERC721_WHITELIST_SALE = keccak256(abi.encodePacked("ERC721_WHITELIST_SALE"));
    bytes32 constant TREASURY = keccak256("WALLET"); //TODO: rename wallet to TREASURY
    bytes32 constant RELEASE_MANAGER = keccak256(abi.encodePacked("RELEASE_MANAGER"));
}
