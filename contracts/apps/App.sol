// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "../kernel/interfaces/IKernel.sol";
import "../libraries/Exceptions.sol";
import "./UpgradeableApp.sol";

/**
 * @title App
 * @author SuperdaoTeam
 * @notice Create apps on Kernel for ERC721 protocol Sale
 *
 */
abstract contract App is UpgradeableApp, Initializable, ERC2771Context {
    IKernel public kernel;
    uint8 private _nextRoleId = 0;

    uint256[99] private __gap;

    /**
     * @dev Declare events for kernel and address
     *
     */
    event Init(IKernel kernel);
    event Upgrade(address code);
    event ProxyMigrated(address newBeacon, address beaconProxy);

    /**
     * @dev Checks the permission, so the function is executed and otherwise, an exception is thrown.
     *
     */
    modifier requirePermission(uint8 permissionId) {
        require(_hasPermission(permissionId), Exceptions.INVALID_AUTHORIZATION_ERROR);
        _;
    }

    /**
     * @dev Verify Kernel permission, so the function is executed and otherwise, an exception is thrown.
     *
     */
    modifier onlyKernel() {
        require(_msgSender() == address(kernel), Exceptions.INVALID_AUTHORIZATION_ERROR);
        _;
    }

    /**
     * @dev Update via appCode
     *
     */
    function upgrade(address appCode) external onlyKernel {
        _getImplementationSlot().value = appCode;

        emit Upgrade(appCode);
    }

    function migrateToBeacon(address newBeacon, address beaconProxy) external onlyKernel {
        _getBeaconSlot().value = newBeacon;
        _getImplementationSlot().value = beaconProxy;

        emit ProxyMigrated(newBeacon, beaconProxy);
    }

    /**
     * @dev Add appCode for external access
     *
     */
    function implementation() external view returns (address) {
        return _getImplementationSlot().value;
    }

    /**
     * @dev Initialize App for Kernel access
     *
     */
    function __App_init(IKernel _kernel) internal onlyInitializing {
        kernel = _kernel;

        emit Init(kernel);
    }

    /**
     * @dev Error-handling via assert toll and checking if role numbers is less than 15
     *
     */
    function _initNextRole() internal returns (uint8) {
        require(_nextRoleId < 15, Exceptions.VALIDATION_ERROR);

        return _nextRoleId++;
    }

    /**
     * @dev Checks if permission is granted and returns via msgSender
     *
     */
    function _hasPermission(uint8 permissionId) internal view returns (bool) {
        return kernel.hasPermission(_msgSender(), address(this), permissionId);
    }
}
