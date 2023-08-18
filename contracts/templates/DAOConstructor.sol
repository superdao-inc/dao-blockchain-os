// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../apps/AppBeaconProxy.sol";
import "../kernel/Kernel.sol";
import "../apps/AdminController/AdminController.sol";
import "../apps/ERC721Sale/ERC721OpenSale.sol";
import "../apps/ERC721Sale/ERC721WhitelistSale.sol";
import "../apps/ERC721Properties/ERC721Properties.sol";
import "./Models.sol";
import "../libraries/Semver.sol";
import "./IDAOConstructor.sol";

contract DAOConstructor is
    UpgradeableApp,
    Initializable,
    OwnableUpgradeable,
    IDAOConstructor,
    __with_semver(uint8(1), uint8(4), uint8(0))
{
    IUpdateManager public updateManager;
    ISafeFactory public safeFactory;
    ISafe public safeSingleton;

    event Deployed(Kernel kernel, Models.AdditionalModules[] modules, Models.DeploymentSettings deploymentSettings);
    event Upgrade(address code);

    function initialize(IUpdateManager updateManager_) external initializer {
        __Ownable_init();
        updateManager = updateManager_;
    }

    function upgrade(address appCode) external onlyOwner {
        _getImplementationSlot().value = appCode;

        emit Upgrade(appCode);
    }

    function implementation() external view returns (address) {
        return _getImplementationSlot().value;
    }

    function setUpdateManager(IUpdateManager updateManager_) external onlyOwner {
        updateManager = updateManager_;

        // emit UpdateManagerSet(UpdateManager);
    }

    function deploy(
        Models.AdditionalModules[] calldata modules,
        Models.DeploymentSettings calldata deploymentSettings,
        address treasury
    ) external {
        address kernelBeaconAddr = updateManager.getBeacon(AppsIds.KERNEL);

        bytes memory emptyBytes;
        Kernel kernel = Kernel(address(new AppBeaconProxy(kernelBeaconAddr, emptyBytes)));
        kernel.initialize(address(this), deploymentSettings.adminSettings.releaseManager);

        _deployAdmin(kernel, deploymentSettings.adminSettings);
        ERC721Properties erc721 = _deployERC721(kernel, deploymentSettings.nftSettings);

        for (uint256 i = 0; i < modules.length; i++) {
            Models.AdditionalModules module = modules[i];
            if (module == Models.AdditionalModules.OpenSale) {
                _deployOpenSale(kernel, erc721, deploymentSettings.openSaleSettings);
            } else if (module == Models.AdditionalModules.WhitelistSale) {
                _deployWhiteListSale(kernel, erc721, deploymentSettings.whiteListSaleSettings);
            }
        }

        if (treasury == address(0)) {
            address[] memory owners = new address[](1);
            owners[0] = deploymentSettings.adminSettings.creator;
            treasury = kernel.deploySafe(owners, 1);
        }

        kernel.setTreasury(treasury);
        Kernel(kernel).resetApp(AppsIds.SUDO, owner(), false);
        emit Deployed(kernel, modules, deploymentSettings);
    }

    function _deployAdmin(Kernel kernel, Models.AdminSettings calldata adminSetting)
        internal
        returns (AdminController)
    {
        AdminController admin = AdminController(
            kernel.deployApp(
                AppsIds.ADMIN_CONTROLLER,
                abi.encodeCall(AdminController.initialize, (kernel, adminSetting.admins, adminSetting.creator))
            )
        );

        kernel.addPermission(AppsIds.SUDO, AppsIds.ADMIN_CONTROLLER, AdminController(admin).SUDO());
        kernel.addPermission(AppsIds.RELEASE_MANAGER, AppsIds.ADMIN_CONTROLLER, AdminController(admin).SUDO());
        kernel.addPermission(AppsIds.ADMIN_CONTROLLER, AppsIds.KERNEL, AdminController(admin).SUDO());

        return admin;
    }

    function _deployERC721(Kernel kernel, Models.NFTSettings calldata nftSettings) internal returns (ERC721Properties) {
        ERC721Properties erc721 = ERC721Properties(
            kernel.deployApp(
                AppsIds.ERC721,
                abi.encodeCall(
                    ERC721Properties(address(0)).initialize,
                    (
                        ERC721Properties.Initialization({
                            kernel: kernel,
                            openseaOwner: nftSettings.openseaOwner,
                            baseURI: nftSettings.url,
                            name: nftSettings.name,
                            symbol: nftSettings.symbol
                        })
                    )
                )
            )
        );

        kernel.addPermission(AppsIds.SUDO, AppsIds.ERC721, ERC721Properties(erc721).CONTROLLER());
        kernel.addPermission(AppsIds.ADMIN_CONTROLLER, AppsIds.ERC721, ERC721Properties(erc721).CONTROLLER());
        kernel.addPermission(AppsIds.RELEASE_MANAGER, AppsIds.ERC721, ERC721Properties(erc721).CONTROLLER());

        for (uint256 i = 0; i < nftSettings.attributes.length; i++) {
            Models.Attribute memory attribute = nftSettings.attributes[i];
            erc721.setAttribute("TIER", attribute.tierId, attribute.attrName, attribute.value);
        }

        return erc721;
    }

    function _deployOpenSale(
        Kernel kernel,
        ERC721Properties erc721,
        Models.SaleSettings calldata openSaleSettings
    ) internal returns (ERC721OpenSale) {
        ERC721OpenSale openSale = ERC721OpenSale(
            kernel.deployApp(AppsIds.ERC721_OPEN_SALE, abi.encodeCall(ERC721OpenSale.initialize, (kernel)))
        );

        kernel.addPermission(AppsIds.SUDO, AppsIds.ERC721_OPEN_SALE, ERC721OpenSale(openSale).CONTROLLER());
        kernel.addPermission(AppsIds.RELEASE_MANAGER, AppsIds.ERC721_OPEN_SALE, ERC721OpenSale(openSale).CONTROLLER());
        kernel.addPermission(AppsIds.ADMIN_CONTROLLER, AppsIds.ERC721_OPEN_SALE, ERC721OpenSale(openSale).CONTROLLER());
        kernel.addPermission(AppsIds.ERC721_OPEN_SALE, AppsIds.ERC721, ERC721Properties(erc721).CONTROLLER());

        if (openSaleSettings.claimLimit > uint64(0)) {
            openSale.setClaimLimit(openSaleSettings.claimLimit);
        }
        openSale.setPaymentPolicy(openSaleSettings.tiersValues, openSaleSettings.tiersPrices);
        openSale.setTokenSaleAddress(openSaleSettings.tokenSaleAddress);

        return openSale;
    }

    function _deployWhiteListSale(
        Kernel kernel,
        ERC721Properties erc721,
        Models.SaleSettings calldata whiteListSale
    ) internal returns (ERC721WhitelistSale) {
        ERC721WhitelistSale erc721WhitelistSale = ERC721WhitelistSale(
            kernel.deployApp(AppsIds.ERC721_WHITELIST_SALE, abi.encodeCall(ERC721WhitelistSale.initialize, (kernel, 0)))
        );

        kernel.addPermission(
            AppsIds.SUDO,
            AppsIds.ERC721_WHITELIST_SALE,
            ERC721WhitelistSale(erc721WhitelistSale).CONTROLLER()
        );
        kernel.addPermission(
            AppsIds.ADMIN_CONTROLLER,
            AppsIds.ERC721_WHITELIST_SALE,
            ERC721WhitelistSale(erc721WhitelistSale).CONTROLLER()
        );
        kernel.addPermission(
            AppsIds.RELEASE_MANAGER,
            AppsIds.ERC721_WHITELIST_SALE,
            ERC721WhitelistSale(erc721WhitelistSale).CONTROLLER()
        );
        kernel.addPermission(AppsIds.ERC721_WHITELIST_SALE, AppsIds.ERC721, ERC721Properties(erc721).CONTROLLER());

        erc721WhitelistSale.setPaymentPolicy(whiteListSale.tiersValues, whiteListSale.tiersPrices);
        erc721WhitelistSale.setActive(true);

        if (whiteListSale.claimLimit > uint64(0)) {
            erc721WhitelistSale.setClaimLimit(whiteListSale.claimLimit);
        }

        return erc721WhitelistSale;
    }
}
