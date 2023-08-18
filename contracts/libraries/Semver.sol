// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

abstract contract __with_semver {
    uint8 private immutable __semver_major;
    uint8 private immutable __semver_minor;
    uint8 private immutable __semver_patch;

    constructor(
        uint8 _major,
        uint8 _minor,
        uint8 _patch
    ) {
        __semver_major = _major;
        __semver_minor = _minor;
        __semver_patch = _patch;
    }

    function __semver() public view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "v",
                    uint8(0x30) + __semver_major,
                    ".",
                    uint8(0x30) + __semver_minor,
                    ".",
                    uint8(0x30) + __semver_patch
                )
            );
    }
}
