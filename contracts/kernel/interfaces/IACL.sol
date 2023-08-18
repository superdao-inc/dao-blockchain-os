// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

interface IACL {
    function addPermission(
        bytes32 entity,
        bytes32 app,
        uint8 permission
    ) external;

    function removePermission(
        bytes32 entity,
        bytes32 app,
        uint8 permission
    ) external;

    function getPermissions(bytes32 entity, bytes32 app) external view returns (bytes2);

    function hasPermission(
        address entityAddress,
        address appAddress,
        uint8 permissionId
    ) external view returns (bool);
}
