// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "./IACL.sol";
import "./IAppManager.sol";

interface IKernel is IACL, IAppManager {
    function getUpdateManager() external view returns (address);

    function upgradeApp(bytes32 id) external;

    function setTreasury(address treasury) external;

    function getTreasury() external view returns (address);

    function deploySafe(address[] calldata owners, uint256 threshold) external returns (address);

    function deployApp(bytes32 id, bytes calldata data) external returns (address);

    event SafeDeployed(address safe);

    event TreasuryChanged(address treasury);
}
