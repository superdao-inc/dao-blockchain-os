// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../libraries/Exceptions.sol";
import {__with_semver} from "../libraries/Semver.sol";

/**
 * @title CallForwarder.sol
 * @author SuperdaoTeam
 * @dev Call forwarded performs proxying of requests for OS applications and allows them
 * to be executed in patches. In OS applications, the _msgSender() will be the original address
 * calling the CallForwarder, and not the proxying contract itself.
 */

contract CallForwarder is EIP712, __with_semver(uint8(1), uint8(1), uint8(0)) {
    using ECDSA for bytes32;

    /**
     * @dev The request in the contract has the following structure.
     *
     */
    struct ForwardRequest {
        address from; // @param Externally-owned account (EOA) making the request.
        address to; // @param Destination address, normally a smart contract.
        uint256 value; // @param Amount of ether to transfer to the destination.
        uint256 nonce; // @param  On-chain tracked nonce of a transaction.
        bytes data; // @param (Call)data to be sent to the destination.
    }

    bytes32 private constant _TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 nonce,bytes data)");

    mapping(address => uint256) private _nonces;

    event MetaTransactionExecuted(address indexed from, address indexed to, bytes indexed data);

    constructor(string memory name, string memory version) EIP712(name, version) {}

    /**
     * @dev Returns the domain separator used in the encoding of the signature for `execute`,
     * as defined by {EIP712}.
     * See https://eips.ethereum.org/EIPS/eip-712
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev Retrieves the on-chain tracked nonce of an EOA making the request.
     *
     */
    function getNonce(address from) external view returns (uint256) {
        return _nonces[from];
    }

    function getSigner(ForwardRequest calldata req, bytes calldata signature) public view returns (address signer) {
        signer = getMessageHash(req).recover(signature);
    }

    function getMessageHash(ForwardRequest calldata req) public view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(abi.encode(_TYPEHASH, req.from, req.to, req.value, req.nonce, keccak256(req.data)))
            );
    }

    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        address signer = getSigner(req, signature);
        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    /**
     * @dev Requests are sent using the executeSingle methods, which have an overload.
     * The main difference between
     * function executeSingle(ForwardRequest calldata req, bytes calldata signature) and
     * function executeSingle(ForwardRequest calldata req) is that if a signature was transmitted,
     * the sender address will be formed from the signature, otherwise from msg.sender.
     */

    function executeSingle(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bytes memory returnData)
    {
        require(verify(req, signature), "CallForwarder: signature does not match request");
        _nonces[req.from]++;
        returnData = _execute(req);
        _refund();

        emit MetaTransactionExecuted(req.from, req.to, req.data);
    }

    function executeSingle(ForwardRequest calldata req) public payable returns (bytes memory returnData) {
        require(req.from == msg.sender, "AwlForwarder: msg.sender must be equals with req.from");
        returnData = _execute(req);
        _refund();
    }

    /**
     * @dev Also, the executeSingle method can be executed in batches.
     *
     */
    function executeBatch(ForwardRequest[] calldata reqs, bytes[] calldata signatures)
        external
        payable
        returns (bytes[] memory)
    {
        require(
            reqs.length == signatures.length,
            "length of forward requests must be similar with length of signatures"
        );
        bytes[] memory results = new bytes[](reqs.length);
        for (uint256 i = 0; i < results.length; i++) {
            require(verify(reqs[i], signatures[i]), "CallForwarder: signature does not match request");
            results[i] = _execute(reqs[i]);
        }
        _refund();
        return results;
    }

    function executeBatch(ForwardRequest[] calldata reqs) external payable returns (bytes[] memory) {
        bytes[] memory results = new bytes[](reqs.length);
        for (uint256 i = 0; i < results.length; i++) {
            results[i] = _execute(reqs[i]);
        }
        _refund();
        return results;
    }

    function _refund() private {
        uint256 balance = address(this).balance;
        if (balance != 0) {
            Address.sendValue(payable(msg.sender), balance);
        }
    }

    function _execute(ForwardRequest calldata req) private returns (bytes memory returnData) {
        returnData = Address.functionCallWithValue(
            req.to,
            abi.encodePacked(req.data, req.from),
            req.value,
            Exceptions.INVALID_AUTHORIZATION_ERROR
        );
    }
}
