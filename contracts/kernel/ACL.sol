// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "./interfaces/IACL.sol";
import "../libraries/Permission.sol";
import "../libraries/Exceptions.sol";
import "./BaseStorage.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";

/**
 * @title Access Control List
 * @author SuperdaoTeam
 * @notice Provides data access controls features
 */
contract ACL is BaseStorage, IACL {
    /**
     * @dev Defines variables.
     *
     */
    uint8 public immutable KERNEL_ADMIN = _initNextRole();

    uint256[100] private __gap;

    /**
     * @dev Gives an address and trustedForwarder Base Storage.
     *
     */
    constructor(address trustedForwarder) BaseStorage(trustedForwarder) {}

    /**
     * @dev Adds Permission via requesting requesterAppId, appId, and permissionId for KERNEL_ADMIN
     *
     */
    function addPermission(
        bytes32 requesterAppId,
        bytes32 appId,
        uint8 permissionId
    ) external requirePermission(KERNEL_ADMIN) {
        _addPermission(requesterAppId, appId, permissionId);
    }

    /**
     * @dev The same Permission route, but removes Permission
     *
     */
    function removePermission(
        bytes32 requesterAppId,
        bytes32 appId,
        uint8 permissionId
    ) external requirePermission(KERNEL_ADMIN) {
        _removePermission(requesterAppId, appId, permissionId);
    }

    /**
     * @dev Gets Permissions by checking the right row and column via index-matching
     *
     */
    function getPermissions(bytes32 entity, bytes32 app) external view returns (bytes2) {
        (uint16 row, uint256 column) = _calculateIndex(_appInfo[entity].index);

        return _appInfo[app].slots[row][column];
    }

    /**
     * @dev As in functions addPermission and removePermission, takes the same variables, but
     * returns a specific permissionId. It is needed to check for the presence of certain rights
     * at a certain address, it outputs true/false.
     */
    function hasPermission(
        address entityAddress,
        address appAddress,
        uint8 permissionId
    ) external view returns (bool) {
        bytes2 permissions = Permission._getCode(permissionId);

        bytes32 entityId = _appIdByAddress[entityAddress];
        bytes32 appId = _appIdByAddress[appAddress];
        if (appId == bytes32(0)) {
            return false;
        }

        (uint16 row, uint256 column) = _calculateIndex(_appInfo[entityId].index);

        return (_appInfo[appId].slots[row][column] & permissions) == permissions;
    }

    /**
     * @dev As in function addPermission internally returns requesterAppIdrequesterAppId in index calculation
     *
     */
    function _addPermission(
        bytes32 requesterAppId,
        bytes32 appId,
        uint8 permissionId
    ) internal {
        (uint16 row, uint256 column) = _calculateIndex(_appInfo[requesterAppId].index);

        _appInfo[appId].slots[row][column] |= Permission._getCode(permissionId);
    }

    /**
     * @dev As in function removePermission internally returns requesterAppIdrequesterAppId in index calculation
     *
     */
    function _removePermission(
        bytes32 requesterAppId,
        bytes32 appId,
        uint8 permissionId
    ) internal {
        (uint16 row, uint256 column) = _calculateIndex(_appInfo[requesterAppId].index);

        _appInfo[appId].slots[row][column] &= ~Permission._getCode(permissionId);
    }

    /**
     * @dev Internally calcualtes indexes: row defines by dividing index on SLOT_SIZE;
     * column defines by dividing withount remainder index % SLOT_SIZE.
     * Returns numbers of row and column.
     */
    function _calculateIndex(uint16 index) private pure returns (uint16, uint256) {
        uint16 row = index / SLOT_SIZE;
        uint256 column = index % SLOT_SIZE;

        return (row, column);
    }

    // TODO: Add support ERC-165 interface checks.
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IACL).interfaceId || interfaceId == type(IERC165Upgradeable).interfaceId;
    }
}
