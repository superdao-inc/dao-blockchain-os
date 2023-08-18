// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../../libraries/Exceptions.sol";
import "../App.sol";
import "../ERC721Properties/ERC721Properties.sol";
import "../ERC721Sale/ERC721WhitelistSale.sol";
import "../ERC721Sale/ERC721OpenSale.sol";
import {__with_semver} from "../../libraries/Semver.sol";

/**
 * @title AdminController
 * @author SuperdaoTeam
 * @dev Create a new role identifier for Admin, Creator, SUDO-permissioner.
 * This contract module, as multi-signature wallet, allows to implement role-based access
 * control mechanisms. This is a lightweight version that puts admin addresses is
 * in a form of set of wallet with access to admin-controlling functions.
 *
 */
contract AdminController is App, __with_semver(uint8(1), uint8(2), uint8(0)) {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint8 public immutable SUDO = _initNextRole();

    EnumerableSet.AddressSet private _adminAddresses;

    /**
     * Creator functions as an admin, but what makes this role so special is that Creator can delete other admins
     */
    address private _creator;

    uint256[98] private __gap;

    /**
     * @dev Declare events for adding and removing admins
     */
    event AddAdmin(address admin);
    event RemoveAdmin(address admin);
    event Creator(address creator);

    /**
     * @dev Condition of modifier is satisfied while checking the admin-status,
     * so the function is executed and otherwise, an exception is thrown.
     *
     * The format of the revert reason is given by the following conditional regular expression.
     */
    modifier onlyAdmin() {
        require(_isAdmin(_msgSender()) || _isCreator(_msgSender()), Exceptions.INVALID_AUTHORIZATION_ERROR);
        _;
    }

    /**
     * @dev Modifier that checks whether it is an admin or SUDO permission is granted. Reverts
     * with a standardized message including the required role.
     *
     * The format of the revert reason is given by the following conditional regular expression.
     *
     */
    modifier onlyAdminOrSudo() {
        require(
            _isAdmin(_msgSender()) || _isCreator(_msgSender()) || _hasPermission(SUDO),
            Exceptions.INVALID_AUTHORIZATION_ERROR
        );
        _;
    }

    /**
     * @dev Modifier that checks whether it is a Creator or SUDO permission is granted. Reverts
     * with a standardized message including the required role.
     *
     * The format of the revert reason is given by the following conditional regular expression.
     */
    modifier onlyCreatorOrSudo() {
        require(_isCreator(_msgSender()) || _hasPermission(SUDO), Exceptions.INVALID_AUTHORIZATION_ERROR);
        _;
    }

    /**
     * @dev Modifier that checks whether the SUDO permission is granted. Reverts
     * with a standardized message including the required role.
     *
     * The format of the revert reason is given by the following conditional regular expression.
     */
    modifier onlySudo() {
        require(_hasPermission(SUDO), Exceptions.INVALID_AUTHORIZATION_ERROR);
        _;
    }

    /**
     * @dev This is the constructor which registers trustedForwarder in ERC2771Context
     */
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    /**
     * @dev It provides permission management for access to application contracts functions, plus
     * in the loop adds admins' addresses if the number is less than the existing amount of admins.
     *
     */
    function initialize(
        IKernel _kernel,
        address[] calldata admins,
        address creatorAddress
    ) external initializer {
        __App_init(_kernel);
        _creator = creatorAddress;
        for (uint256 i = 0; i < admins.length; i++) {
            _adminAddresses.add(admins[i]);
            emit AddAdmin(admins[i]);
        }
        emit Creator(creatorAddress);
    }

    /**
     * @dev Returns an array of admins addresses
     */
    function adminAddresses() external view returns (address[] memory) {
        return _adminAddresses.values();
    }

    /**
     * @dev Returns a boolean value indicating whether the admin status is succeeded.
     */
    function isAdmin(address adminAddress) external view returns (bool) {
        return _isAdmin(adminAddress);
    }

    /**
     * @dev Returns a boolean value indicating whether the Creator status is succeeded.
     */
    function _isCreator(address creatorAddress) private view returns (bool) {
        return creatorAddress == _creator;
    }

    /**
     * @dev Returns a creator's address.
     */
    function creator() external view virtual returns (address) {
        return _creator;
    }

    /**
     * @dev Function adds an admin, if only admin or SUDO permission executes this,
     * later the function is executed and otherwise, an exception is thrown.
     */
    function addAdmin(address adminAddress) external onlyAdminOrSudo {
        require(_adminAddresses.add(adminAddress), Exceptions.INVARIANT_ERROR);

        emit AddAdmin(adminAddress);
    }

    /**
     * @dev Function removes an admin, if only Creator or SUDO permission executes this,
     * later the function is executed and otherwise, an exception is thrown.
     */
    function removeAdmin(address adminAddress) external onlyCreatorOrSudo {
        require(_adminAddresses.remove(adminAddress), Exceptions.INVARIANT_ERROR);

        emit RemoveAdmin(adminAddress);
    }

    /**
     * @dev Function sets a new Creator with Creator's address, if only SUDO permission executes this.
     */
    function setCreator(address newCreator) external onlySudo {
        _creator = newCreator;
        emit Creator(_creator);
    }

    /**
     * @dev Function invokes receiver's address and all transmitted info in calldata, if only admin
     * or SUDO permission executes this. Returns values of functionCall.
     * The function executes correctly, otherwise an exception (INVALID_AUTHORIZATION_ERROR) is thrown.
     */
    function call(address to, bytes calldata data) public virtual onlyAdminOrSudo returns (bytes memory) {
        return Address.functionCall(to, data, Exceptions.INVALID_AUTHORIZATION_ERROR);
    }

    /**
     * @dev Function invokes arrays of calldata addresses and calldata data, if only admin
     * or SUDO permission executes this. Returns values as results, which formes from a loop, where
     * index should be strictly less than data.length.
     */
    function batchCall(address[] calldata addresses, bytes[] calldata data)
        external
        virtual
        onlyAdminOrSudo
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            results[i] = call(addresses[i], data[i]);
        }
        return results;
    }

    function mint(address to, bytes32 tierValue) external onlyAdminOrSudo {
        ERC721Properties(kernel.getAppAddress(AppsIds.ERC721)).mint(to, tierValue);
    }

    function batchMint(address[] calldata to, bytes32[] calldata tierValues) external onlyAdminOrSudo {
        require(to.length == tierValues.length, Exceptions.VALIDATION_ERROR);
        for (uint256 i = 0; i < to.length; i++) {
            ERC721Properties(kernel.getAppAddress(AppsIds.ERC721)).mint(to[i], tierValues[i]);
        }
    }

    function burn(uint32 tokenId) external onlyAdminOrSudo {
        ERC721Properties(kernel.getAppAddress(AppsIds.ERC721)).burn(tokenId);
    }

    function batchBurn(uint32[] calldata tokenIds) external onlyAdminOrSudo {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            ERC721Properties(kernel.getAppAddress(AppsIds.ERC721)).burn(tokenIds[i]);
        }
    }

    function setBaseURI(string calldata uri) external onlyAdminOrSudo {
        ERC721Properties(kernel.getAppAddress(AppsIds.ERC721)).setBaseURI(uri);
    }

    function setRestrictBurnPolicy(bool burnPolicy) external onlyAdminOrSudo {
        ERC721Properties(kernel.getAppAddress(AppsIds.ERC721)).setRestrictBurnPolicy(burnPolicy);
    }

    function openSale__setPaymentPolicy(bytes32[] calldata tierValues, uint256[] calldata tierPrices_)
        external
        onlyAdminOrSudo
    {
        ERC721OpenSale(kernel.getAppAddress(AppsIds.ERC721_OPEN_SALE)).setPaymentPolicy(tierValues, tierPrices_);
    }

    function whitelistSale__setPaymentPolicy(bytes32[] calldata tierValues, uint256[] calldata tierPrices_)
        external
        onlyAdminOrSudo
    {
        ERC721WhitelistSale(kernel.getAppAddress(AppsIds.ERC721_WHITELIST_SALE)).setPaymentPolicy(
            tierValues,
            tierPrices_
        );
    }

    function whitelistSale__setMerkleTree(bytes32 merkleRoot, bytes calldata merkleProofIpfsHash)
        external
        onlyAdminOrSudo
    {
        ERC721WhitelistSale(kernel.getAppAddress(AppsIds.ERC721_WHITELIST_SALE)).setMerkleTree(
            merkleRoot,
            merkleProofIpfsHash
        );
    }

    /**
     * @dev Returns Admin's address in a private view
     */
    function _isAdmin(address adminAddress) private view returns (bool) {
        return _adminAddresses.contains(adminAddress);
    }
}
