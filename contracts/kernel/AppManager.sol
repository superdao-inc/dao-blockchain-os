// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "./ACL.sol";
import "./BaseStorage.sol";
import "./interfaces/IAppManager.sol";
import "../apps/AppProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "../apps/AppBeaconProxy.sol";
import "../updateManager/IUpdateManager.sol";


/**
 * @title App Manager
 * @author SuperdaoTeam
 * @notice Provides data access controls features
 */
contract AppManager is ACL, IAppManager {
    string constant APP_WAS_INITED_ERROR = "APP_WAS_INITED";

    uint256[100] private __gap;

    event SetApp(bytes32 id, address app, bool isNative);

    constructor(address trustedForwarder) ACL(trustedForwarder) {}

    /**
     * @dev Function deploys app by taking variables idd, address and data. It is needed
     * to require Kernel Permission for the presence of certain rights
     * at a certain address. In a successful scenario (TRUE) returns proxy,
     * otherwise throws an error: INVALID_INITIALIZATION_ERROR.
     */
    function _deployApp(
        address updateManager_,
        bytes32 id,
        bytes calldata data
    ) internal requirePermission(KERNEL_ADMIN) returns (address) {
        address beacon = IUpdateManager(updateManager_).getBeacon(id);
        address appProxy = address(new AppBeaconProxy(beacon, data));
        _setApp(id, appProxy, true);
        return appProxy;
    }

    function _deployBeaconProxy(address beacon, bytes memory data) internal returns (address) {
        return address(new BeaconProxy(beacon, data));
    }

    /**
     * @dev Connects via requesting KERNEL_AdMIN rights and setting specific id and address.
     *
     */
    function connectApp(
        bytes32 id,
        address appAddress,
        bool isNative
    ) external requirePermission(KERNEL_ADMIN) {
        _setApp(id, appAddress, isNative);
    }

    /**
     * @dev Resets via requesting KERNEL_ADMIN rights and setting specific id and address.
     *
     */
    function resetApp(
        bytes32 id,
        address appAddress,
        bool isNative
    ) external requirePermission(KERNEL_ADMIN) {
        _resetApp(id, appAddress, isNative);
    }

    /**
     * @dev Gets an address by connecting app's id.
     *
     */
    function getAppAddress(bytes32 id) external view returns (address) {
        return _appInfo[id].addr;
    }

    /**
     * @dev As resetApp fuction, here it also resets an existed app by checking
     * the correct id, otherwise throws an error ILLEGAL_ADDRESS.
     * If the condition is satisfied it delletes an app.
     *
     */
    function _resetApp(
        bytes32 id,
        address app,
        bool isNative
    ) internal {
        bytes32 existedApp = _appIdByAddress[app];
        if (existedApp != id) {
            require(existedApp == bytes32(0), Exceptions.ILLEGAL_ADDRESS);
        }
        delete _appIdByAddress[_appInfo[id].addr];

        _appInfo[id].addr = app;
        _appInfo[id].isActive = true;
        _appInfo[id].isNative = isNative;

        _appIdByAddress[app] = id;
    }

    /**
     * @dev Sets an app by requiring specific address and id format.
     *
     */
    function _setApp(
        bytes32 id,
        address app,
        bool isNative
    ) internal {
        require(
            _appInfo[id].addr == address(0x00) && _appIdByAddress[app] == bytes32(0),
            Exceptions.APP_WAS_INITED_ERROR
        );

        _appInfo[id].addr = app;
        _appInfo[id].index = _nextIndex;
        _appInfo[id].isActive = true;
        _appInfo[id].isNative = isNative;

        _appIdByAddress[app] = id;
        _nextIndex++;
        emit SetApp(id, app, isNative);
    }

    /**
     * TODO: Add support ERC-165 interface checks.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ACL) returns (bool) {
        return interfaceId == type(IAppManager).interfaceId || super.supportsInterface(interfaceId);
    }
}
