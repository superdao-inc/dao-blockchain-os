// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

library Permission {
    string constant INVALID_PERMISSION_ID_ERROR = "INVALID_PERMISSION_ID";

    function _getCode(uint8 id) internal pure returns (bytes2) {
        require(id < 16, INVALID_PERMISSION_ID_ERROR);
        return bytes2(uint16(1 << id));
    }
}
