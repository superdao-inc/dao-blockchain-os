// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "../libraries/Gap50.sol";
import "../apps/App.sol";
import "./interfaces/IKernel.sol";

/**
 * @title Base Storage
 * @author SuperdaoTeam
 * @notice Creates Apps' storage and puts information into IKernel.
 */
contract BaseStorage is Gap50, App {
    uint8 constant SLOT_SIZE = 16;
    struct AppInfo {
        address addr;
        uint16 index;
        bool isActive;
        bool isNative;
        mapping(uint16 => bytes2[SLOT_SIZE]) slots;
    }

    uint16 internal _nextIndex;

    /**
     * @dev Transmits app's address and info in a map.
     *
     */
    mapping(address => bytes32) internal _appIdByAddress;
    mapping(bytes32 => AppInfo) internal _appInfo;

    uint256[97] private __gap;

    /**
     * @dev This is the constructor which registers trustedForwarder in ERC2771Context.
     *
     */
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    /**
     * @dev Initialises an app in IKernel.
     *
     */
    function __BaseStorage_init() internal onlyInitializing {
        __App_init(IKernel(address(this)));
    }
}
