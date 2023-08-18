// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../apps/App.sol";
import "../kernel/Kernel.sol";

contract MockApp is App {
    uint8 immutable SUDO = _initNextRole();

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    function initialize(IKernel kernel) external initializer {
        __App_init(kernel);
    }

    function appCall(address to, bytes calldata data) external returns (bytes memory) {
        (bool success, bytes memory result) = to.call(data);
        require(success);
        return result;
    }

    function testRequireSUDO() external requirePermission(SUDO) {}

    function callTestRequireSUDO(MockApp app) external {
        app.testRequireSUDO();
    }
}
