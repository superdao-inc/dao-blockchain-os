// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

interface VRFConsumer {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

interface VRFCoordinatorV2Interface {
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);
}

contract MockVRFCoordinator is VRFCoordinatorV2Interface {
    uint256 public id;
    mapping(uint256 => address) public requests;

    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId) {
        id++;
        requestId = id;
        requests[requestId] = msg.sender;
        keyHash = keyHash;
        subId = subId;
        minimumRequestConfirmations = minimumRequestConfirmations;
        callbackGasLimit = callbackGasLimit;
        numWords = numWords;
    }

    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        address consumer = requests[requestId];
        VRFConsumer(consumer).rawFulfillRandomWords(requestId, randomWords);
    }
}
