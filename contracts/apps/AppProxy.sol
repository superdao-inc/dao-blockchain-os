// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "./UpgradeableApp.sol";

/**
 * @title AppProxy
 * @author SuperdaoTeam
 * @notice Initialize Proxy for App
 *
 */
contract AppProxy is Proxy, UpgradeableApp {
    uint256[100] private __gap;

    /**
     * @dev Sets the value for implementation
     *
     */
    constructor(address implementation_) {
        _getImplementationSlot().value = implementation_;
    }

    /**
     * @dev Finds value for Implementation Slot
     *
     */
    function _implementation() internal view override returns (address) {
        return _getImplementationSlot().value;
    }
}
