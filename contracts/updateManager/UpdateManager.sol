// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "./IUpdateManager.sol";
import "../apps/UpgradeableApp.sol";
import "../libraries/Exceptions.sol";
import "../libraries/AppsIds.sol";
import "../libraries/Semver.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract UpdateManager is
    UpgradeableApp,
    Initializable,
    OwnableUpgradeable,
    IUpdateManager,
    __with_semver(uint8(1), uint8(1), uint8(0))
{
    using EnumerableSet for EnumerableSet.AddressSet;
    using AddressUpgradeable for address;

    mapping(bytes32 => EnumerableSet.AddressSet) internal _appsCode;
    mapping(bytes32 => address) public beacons;
    uint256[98] private __gap;

    event SetAppCode(bytes32 app, address admin);
    event Upgrade(address code);
    event BeaconSet(bytes32 indexed id, address indexed beacon);
    event BeaconDeployed(bytes32 indexed id, address indexed implementation, address indexed beacon);
    event BeaconUpdated(bytes32 indexed id, address indexed implementation);

    function initialize(
        address kernel,
        address admin,
        address erc721,
        address erc721OpenSale,
        address erc721WhitelistSale
    ) external initializer {
        __Ownable_init();

        _setAppCode(AppsIds.KERNEL, kernel);
        _setAppCode(AppsIds.ADMIN_CONTROLLER, admin);
        _setAppCode(AppsIds.ERC721, erc721);
        _setAppCode(AppsIds.ERC721_OPEN_SALE, erc721OpenSale);
        _setAppCode(AppsIds.ERC721_WHITELIST_SALE, erc721WhitelistSale);
    }

    function upgrade(address appCode) external onlyOwner {
        _getImplementationSlot().value = appCode;

        emit Upgrade(appCode);
    }

    function implementation() external view returns (address) {
        return _getImplementationSlot().value;
    }

    function setAppCode(bytes32 app, address code) external onlyOwner {
        _setAppCode(app, code);
    }

    function getLastAppCode(bytes32 app) external view returns (address) {
        return _appsCode[app].at(_appsCode[app].length() - 1);
    }

    function getAppCodeHistory(bytes32 app) external view returns (address[] memory) {
        return _appsCode[app].values();
    }

    function _setAppCode(bytes32 app, address code) internal {
        require(_appsCode[app].add(code), Exceptions.INVARIANT_ERROR);

        emit SetAppCode(app, code);
    }

    function getBeacon(bytes32 id) public view returns (address) {
        return beacons[id];
    }

    function getImplementation(bytes32 id) external view returns (address) {
        return UpgradeableBeacon(beacons[id]).implementation();
    }

    function setBeacon(bytes32 id, address beacon) external onlyOwner {
        _setBeacon(id, beacon);
    }

    function _setBeacon(bytes32 id, address beacon) private {
        require(beacon.isContract(), Exceptions.ADDRESS_IS_NOT_CONTRACT);
        beacons[id] = beacon;

        emit BeaconSet(id, beacon);
    }

    function deployBeaconByIds(bytes32[] calldata ids) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            deployBeaconById(ids[i]);
        }
    }

    function deployBeaconById(bytes32 id) public onlyOwner {
        require(_appsCode[id].length() != 0, Exceptions.VALIDATION_ERROR);
        address implementation_ = _appsCode[id].at(_appsCode[id].length() - 1);
        deployBeacon(id, implementation_);
    }

    function deployBeacon(bytes32 id, address implementation_) public onlyOwner {
        require(beacons[id] == address(0), Exceptions.VALIDATION_ERROR);
        require(implementation_.isContract(), Exceptions.ADDRESS_IS_NOT_CONTRACT);

        UpgradeableBeacon beacon = new UpgradeableBeacon(implementation_);
        _setBeacon(id, address(beacon));

        emit BeaconDeployed(id, implementation_, address(beacon));
    }

    function updateBeacon(bytes32 id, address implementation_) external onlyOwner {
        require(beacons[id] != address(0), Exceptions.VALIDATION_ERROR);
        require(implementation_.isContract(), Exceptions.ADDRESS_IS_NOT_CONTRACT);

        UpgradeableBeacon(beacons[id]).upgradeTo(implementation_);

        emit BeaconUpdated(id, implementation_);
    }
}
