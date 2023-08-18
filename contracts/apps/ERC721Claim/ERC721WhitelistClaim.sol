// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "../App.sol";
import "../ERC721Properties/ERC721Properties.sol";
import "../../libraries/Exceptions.sol";
import "../../libraries/AppsIds.sol";
import "../../libraries/Utils.sol";
import {__with_semver} from "../../libraries/Semver.sol";
import "./ERC721BaseClaim.sol";

/**
 * @title ERC721WhitelistClaim
 * @author SuperdaoTeam
 * @dev Implementation of https://eips.ethereum.org/EIPS/eip-721[ERC721] Non-Fungible Token Standard, including
 * the Metadata extension, but not including the Enumerable extension, which is available separately as
 * {ERC721Enumerable}.
 */
contract ERC721WhitelistClaim is ERC721BaseClaim, __with_semver(uint8(1), uint8(1), uint8(0)) {
    string public constant CLAIM_LIMIT_ERROR = "CLAIM_LIMIT_ERROR";

    // @dev Mapping from merkleTreeRoot to __gap
    mapping(bytes32 => uint256) public claimLimitByTier;

    // @dev Mapping from owner address to __gap
    mapping(address => mapping(bytes32 => uint256)) public claims;

    // @dev Initializes the contract by setting ERC2771Context to the trustedForwarder
    constructor(address trustedForwarder) ERC721BaseClaim(trustedForwarder) {}

    // @dev Initialize execution when loading the calldata into the kernel
    function initialize(
        IKernel _kernel,
        bytes32[] calldata tiers,
        uint256[] calldata claimLimits
    ) external initializer {
        __App_init(_kernel);
        require(tiers.length == claimLimits.length, Exceptions.VALIDATION_ERROR);
        for (uint256 i; i != tiers.length; ++i) {
            claimLimitByTier[tiers[i]] = claimLimits[i];
        }
    }

    /**
     * @dev Register an address for `merkleProof` with a given `tierValue`.
     * Note: bytes32 element is generic and can represent various things depending on the whitelisted values.
     */
    function claim(
        address to,
        bytes32[] calldata merkleProof,
        bytes32 tierValue
    ) external {
        require(isActive, Exceptions.NOT_ACTIVE_ERROR);
        require(merkleTreeRoot != bytes32(0), Exceptions.INVALID_INITIALIZATION_ERROR);
        require((++claims[to][tierValue]) <= claimLimitByTier[tierValue], CLAIM_LIMIT_ERROR);
        bytes32 element = keccak256(abi.encodePacked(to, Utils.bytes32ToString(tierValue)));
        require(MerkleProof.verify(merkleProof, merkleTreeRoot, element), Exceptions.VALIDATION_ERROR);
        ERC721Properties(kernel.getAppAddress(AppsIds.ERC721)).mint(to, tierValue);
    }
}
