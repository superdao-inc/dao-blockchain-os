// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

interface IAppManager {
    function connectApp(
        bytes32 id,
        address appAddress,
        bool isNative
    ) external;

    function resetApp(
        bytes32 id,
        address appAddress,
        bool isNative
    ) external;

    function getAppAddress(bytes32 id) external view returns (address);
}
