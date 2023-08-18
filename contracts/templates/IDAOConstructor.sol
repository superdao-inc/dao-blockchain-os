// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "./Models.sol";

interface IDAOConstructor {
    function deploy(
        Models.AdditionalModules[] calldata,
        Models.DeploymentSettings calldata,
        address treasury
    ) external;
}

interface ISafe {
    enum Operation {
        Call,
        DelegateCall
    }

    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool success);
}

interface ISafeFactory {
    function createProxy(address _singleton, bytes memory initializer) external returns (ISafe proxy);
}
