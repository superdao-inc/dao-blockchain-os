// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "../../libraries/Exceptions.sol";
import "../ERC721Properties/ERC721Properties.sol";
import "./ERC721BaseSale.sol";
import {__with_semver} from "../../libraries/Semver.sol";

contract ERC721WhitelistSale is ERC721BaseSale, __with_semver(uint8(1), uint8(1), uint8(0)) {
    bytes public merkleProofIpfsHash; //TODO: mv to string -> merkleURI
    bytes32 private _merkleRoot;

    constructor(address trustedForwarder) ERC721BaseSale(trustedForwarder) {}

    function initialize(IKernel _kernel, uint64 claimLimit_) external initializer {
        __App_init(_kernel);
        claimLimit = claimLimit_;
    }

    function setMerkleTree(bytes32 merkleRoot, bytes calldata merkleProofIpfsHash_)
        external
        requirePermission(CONTROLLER)
    {
        _setMerkleTree(merkleRoot, merkleProofIpfsHash_);
    }

    function buy(bytes32[] calldata proof, bytes32 tierValue) external payable {
        require(_merkleRoot != bytes32(0), Exceptions.INVALID_INITIALIZATION_ERROR);

        uint256 cost = tierPrices[tierValue];
        require(cost != 0 && msg.value >= cost, Exceptions.VALIDATION_ERROR);

        require(isActive, Exceptions.UNAVAILABLE_ERROR);

        bool anyTier = MerkleProof.verify(proof, _merkleRoot, keccak256(abi.encodePacked(_msgSender())));
        if (!anyTier) {
            require(
                MerkleProof.verify(proof, _merkleRoot, keccak256(abi.encodePacked(_msgSender(), tierValue))),
                Exceptions.VALIDATION_ERROR
            );
        }

        _claim(tierValue);
        _transferToTreasury();
        address appAddress = kernel.getAppAddress(AppsIds.ERC721);
        ERC721Properties(appAddress).mint(_msgSender(), tierValue);

        _afterBuy(_msgSender(), appAddress, tierValue, cost, address(0), "Whitelist", __semver());
    }

    function buyWithLimits(
        bytes32[] calldata proof,
        bytes32 tierValue,
        uint256 walletLimit,
        uint256 walletPrice
    ) external payable {
        require(_merkleRoot != bytes32(0), Exceptions.INVALID_INITIALIZATION_ERROR);

        uint256 cost = walletPrice != 0 ? walletPrice : tierPrices[tierValue];
        require(cost != 0 && msg.value >= cost, Exceptions.VALIDATION_ERROR);

        require(isActive, Exceptions.UNAVAILABLE_ERROR);

        if (walletLimit != 0) {
            require(walletLimit > tierPerWalletClaimed[_msgSender()][tierValue], Exceptions.VALIDATION_ERROR);
        }

        bool anyTier = MerkleProof.verify(proof, _merkleRoot, keccak256(abi.encodePacked(_msgSender())));

        if (!anyTier) {
            require(
                MerkleProof.verify(
                    proof,
                    _merkleRoot,
                    keccak256(abi.encodePacked(_msgSender(), tierValue, walletLimit, walletPrice))
                ),
                Exceptions.VALIDATION_ERROR
            );
        }

        _claim(tierValue);
        _transferToTreasury();
        address appAddress = kernel.getAppAddress(AppsIds.ERC721);
        ERC721Properties(appAddress).mint(_msgSender(), tierValue);

        _afterBuy(_msgSender(), appAddress, tierValue, cost, address(0), "Whitelist", __semver());
    }

    function _setMerkleTree(bytes32 merkleRoot, bytes calldata merkleProofIpfsHash_) internal {
        _merkleRoot = merkleRoot;
        merkleProofIpfsHash = merkleProofIpfsHash_;
    }
}
