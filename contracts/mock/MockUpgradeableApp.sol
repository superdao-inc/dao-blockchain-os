// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../apps/UpgradeableApp.sol";

contract MockUpgradeableApp is UpgradeableApp {
    function getImplementationSlot() external pure returns (StorageSlot.AddressSlot memory) {
        return _getImplementationSlot();
    }
}
