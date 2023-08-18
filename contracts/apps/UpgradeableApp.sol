// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/StorageSlot.sol";

/**
 * @title UpgradeableApp
 * @notice Defines the basic implementation slot fo.
 *
 **/
contract UpgradeableApp {
    bytes32 private constant _IMPLEMENTATION_SLOT =
        bytes32(uint256(keccak256("co.superdao.app.proxy.implementation")) - 1);

    bytes32 internal constant _BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    uint256[100] private __gap;

    // @dev Finds value for Implementation Slot
    function _getImplementationSlot() internal pure returns (StorageSlot.AddressSlot storage) {
        return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT);
    }

    function _getBeaconSlot() internal pure returns (StorageSlot.AddressSlot storage) {
        return StorageSlot.getAddressSlot(_BEACON_SLOT);
    }
}
