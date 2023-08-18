// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "../App.sol";
import "../ERC721Properties/ERC721Properties.sol";
import "../../libraries/Exceptions.sol";
import "../../libraries/AppsIds.sol";
import {__with_semver} from "../../libraries/Semver.sol";

/**
 * @title ERC721BaseClaim
 * @author SuperdaoTeam
 * @dev Implementation of https://eips.ethereum.org/EIPS/eip-721[ERC721] Non-Fungible Token Standard, including
 * the Metadata extension, but not including the Enumerable extension, which is available separately as
 * {ERC721Enumerable}.
 */
contract ERC721BaseClaim is App {
    uint8 public immutable CONTROLLER = _initNextRole();

    bool public isActive;

    bytes public merkleTreeURI; // @param ipfs hash -> bytes32
    bytes32 public merkleTreeRoot;
    event SetActive(bool isActive);

    uint256[97] private __gap;

    // @dev Initializes the contract by setting ERC2771Context to the trustedForwarder
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    // @dev Checks if Controller's permission is granted.
    function setActive(bool isActive_) external requirePermission(CONTROLLER) {
        isActive = isActive_;
        emit SetActive(isActive_);
    }

    // @dev Sets merkleTreeRoot and evokes merkleTreeURI
    function setMerkleTree(bytes32 merkleTreeRoot_, bytes calldata merkleTreeURI_)
        external
        requirePermission(CONTROLLER)
    {
        require(isActive, Exceptions.NOT_ACTIVE_ERROR);
        merkleTreeRoot = merkleTreeRoot_;
        merkleTreeURI = merkleTreeURI_;
    }
}
