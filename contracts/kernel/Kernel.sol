// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "./ACL.sol";
import "./AppManager.sol";
import "../updateManager/IUpdateManager.sol";
import "../apps/AdminController/IAdminController.sol";
import "../libraries/AppsIds.sol";
import "../libraries/Exceptions.sol";
import "../libraries/Semver.sol";
import "./interfaces/IKernel.sol";
import "../templates/IDAOConstructor.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title Kernel
 * @author SuperdaoTeam
 * @notice Initializes and operates with Kernel for Apps.
 */
contract Kernel is Initializable, AppManager, IKernel, __with_semver(uint8(1), uint8(1), uint8(0)) {
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IUpdateManager internal immutable _updateManager;
    ISafe public immutable safeSingleton;
    ISafeFactory public immutable safeFactory;
    address public immutable safeFallbackHandler;

    uint256[51] private __gapForUpdateManager;

    address private _treasury;

    event MigratedToSafe(address safe, bool treasury, bool controller);

    /**
     * @dev This is the constructor which registers trustedForwarder in AppManager.
     *
     */
    constructor(
        address trustedForwarder,
        IUpdateManager updateManager,
        ISafe safeSingleton_,
        ISafeFactory safeFactory_,
        address safeFallbackHandler_
    ) AppManager(trustedForwarder) {
        _updateManager = updateManager;
        safeSingleton = safeSingleton_;
        safeFactory = safeFactory_;
        safeFallbackHandler = safeFallbackHandler_;
    }

    /**
     * @dev Via updateManager folder initializes storage space, address, SUDO, Kernel details, permissions.
     *
     */
    function initialize(address sudo, address releaseManager) external initializer {
        __BaseStorage_init();
        _setApp(AppsIds.KERNEL, address(this), true);
        _setApp(AppsIds.SUDO, sudo, false);
        _setApp(AppsIds.RELEASE_MANAGER, releaseManager, false);
        _addPermission(AppsIds.SUDO, AppsIds.KERNEL, KERNEL_ADMIN);
        _addPermission(AppsIds.RELEASE_MANAGER, AppsIds.KERNEL, KERNEL_ADMIN);
    }

    /**
     * @dev Returns externally accessible address.
     *
     */
    function getUpdateManager() external view returns (address) {
        return address(_updateManager);
    }

    function getTreasury() external view returns (address) {
        return _treasury != address(0) ? _treasury : _appInfo[AppsIds.TREASURY].addr;
    }

    function setTreasury(address treasury) public requirePermission(KERNEL_ADMIN) {
        if (_appInfo[AppsIds.TREASURY].addr != address(0)) {
            _resetApp(AppsIds.TREASURY, address(0), false);
        }
        _treasury = treasury;

        emit TreasuryChanged(treasury);
    }

    /**
     * @dev Checks if address's information is in a correct format, otherwise throws an error INVARIANT_ERROR
     * Then upgrades App's Implementation information correspondingly.
     *
     */
    function upgradeAppImpl(bytes32 id, address appImpl) external requirePermission(KERNEL_ADMIN) {
        require(_appInfo[id].isNative && _appInfo[id].addr != address(0x00), Exceptions.INVARIANT_ERROR);

        App app = App(_appInfo[id].addr);
        app.upgrade(appImpl);
    }

    /**
     * @dev Upgrades if address's information is in a correct format, otherwise throws an error INVARIANT_ERROR
     * Then sets new address new code, also by verifing that app.implementation does not equal newCode.
     * Else: sends INVARIANT_ERROR.
     *
     */
    function upgradeApp(bytes32 id) external requirePermission(KERNEL_ADMIN) {
        require(_appInfo[id].isNative && _appInfo[id].addr != address(0x00), Exceptions.INVARIANT_ERROR);

        App app = App(_appInfo[id].addr);

        address newCode = _updateManager.getLastAppCode(id);

        require(app.implementation() != newCode, Exceptions.INVARIANT_ERROR);

        app.upgrade(newCode);
    }

    function migrateApps(bytes32[] calldata ids) external requirePermission(KERNEL_ADMIN) {
        for (uint256 i = 0; i < ids.length; i++) {
            migrateApp(ids[i]);
        }
    }

    function migrateApp(bytes32 id) public requirePermission(KERNEL_ADMIN) {
        bytes memory data;
        App app = App(_appInfo[id].addr);
        address beacon = _updateManager.getBeacon(id);
        address beaconProxy = _deployBeaconProxy(beacon, data);
        app.migrateToBeacon(beacon, beaconProxy);
    }

    // Add support ERC-165 interface checks
    function supportsInterface(bytes4 interfaceId) public view virtual override(AppManager) returns (bool) {
        return interfaceId == type(IKernel).interfaceId || super.supportsInterface(interfaceId);
    }

    // TODO remove it in new implementation after execution
    function setEvent(bytes32[] memory appsIds) external {
        require(msg.sender == 0x22bdc4AA7204f59d78d38d82729bE76CA4e6E4Df, "you are not release manager");
        for (uint256 i = 0; i < appsIds.length; i++) {
            address app = _appInfo[appsIds[i]].addr;
            if (app != address(0)) {
                emit SetApp(appsIds[i], app, true);
            }
        }
    }

    function migrateTreasury() external requirePermission(KERNEL_ADMIN) {
        address[] memory owners = new address[](1);
        owners[0] = IAdminController(_appInfo[AppsIds.ADMIN_CONTROLLER].addr).creator();
        address treasury = deploySafe(owners, 1);
        setTreasury(treasury);
    }

    function deploySafe(address[] memory owners, uint256 threshold)
        public
        requirePermission(KERNEL_ADMIN)
        returns (address)
    {
        bytes memory emptyBytes;
        bytes memory initial = abi.encodeWithSelector(
            ISafe.setup.selector,
            owners,
            threshold,
            address(0),
            emptyBytes,
            safeFallbackHandler,
            address(0),
            0,
            payable(address(0))
        );
        ISafe safe = safeFactory.createProxy(address(safeSingleton), initial);

        emit SafeDeployed(address(safe));

        return address(safe);
    }

    function deployApp(bytes32 id, bytes calldata data) external requirePermission(KERNEL_ADMIN) returns (address) {
        return _deployApp(address(_updateManager), id, data);
    }

    /**
     * @dev Convenience method to initialize an App through kernel
     * and to proceed calls in the App: altogether in 1 transaction.
     */
    function deployAndConfigure(
        bytes32 id,
        bytes calldata initializeAppData,
        bytes[] calldata kernelData,
        bytes[] calldata proxyData
    ) external requirePermission(KERNEL_ADMIN) returns (address) {
        address appProxyAddress = _deployApp(address(_updateManager), id, initializeAppData);

        for (uint256 i; i < kernelData.length; i++) {
            (bool successKernelDataCall, bytes memory message) = address(this).delegatecall(kernelData[i]);
            require(successKernelDataCall, string(message));
        }
        for (uint256 i; i < proxyData.length; i++) {
            (bool successProxyDataCall, bytes memory message) = appProxyAddress.call(proxyData[i]);
            require(successProxyDataCall, string(message));
        }
        return appProxyAddress;
    }
}
