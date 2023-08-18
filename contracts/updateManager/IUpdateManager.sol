// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

interface IUpdateManager {
    function upgrade(address appCode) external;

    function setAppCode(bytes32 app, address code) external;

    function getLastAppCode(bytes32 app) external view returns (address);

    function getAppCodeHistory(bytes32 app) external view returns (address[] memory);

    function getBeacon(bytes32 app) external view returns (address);
}
