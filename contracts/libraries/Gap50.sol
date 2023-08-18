// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract Gap50 is Initializable {
    uint256[50] private __gap;
}
