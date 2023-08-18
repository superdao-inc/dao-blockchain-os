// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title AppProxy
 * @author SuperdaoTeam
 * @notice Initialize Proxy for App
 *
 */
contract AppBeaconProxy is BeaconProxy {
    uint256[100] private __gap;

    /**
     * @dev Sets the value for implementation
     *
     */
    constructor(address beacon, bytes memory data) BeaconProxy(beacon, data) {}
}