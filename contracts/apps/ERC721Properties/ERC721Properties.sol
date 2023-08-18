// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../App.sol";
import "../../libraries/Exceptions.sol";
import "../../libraries/Utils.sol";
import "../../libraries/Semver.sol";
import "../Interfaces/IVRFCoordinatorV2.sol";

/**
 * @title ERC721Properties
 * @author SuperdaoTeam
 * @notice Create a new role identifier for Admin
 */
contract ERC721Properties is ERC721Upgradeable, OwnableUpgradeable, App, __with_semver(uint8(1), uint8(1), uint8(0)) {
    using Strings for uint256;

    type KeyHash is bytes32;

    // @notice Describing components of Initialization stage.
    struct Initialization {
        IKernel kernel;
        address openseaOwner;
        string baseURI;
        string name;
        string symbol;
    }

    struct Properties {
        mapping(KeyHash => bytes32) properties;
    }

    struct Attributes {
        mapping(KeyHash => bytes32) attributes;
    }

    struct VRFRequest {
        address to;
        bytes32 tierValue;
        uint32 tokenId;
    }

    // @param Unchangeable controller invariable.
    uint8 public immutable CONTROLLER = _initNextRole();

    string constant INVALID_TIER_AMOUNT_ERROR = "INVALID_TIER_AMOUNT_ERROR";

    string constant PROPERTY_TIER = "TIER";
    string constant PROPERTY_ARTWORK_ID = "ARTWORK_ID";

    string constant ATTRIBUTE_TIER_EXTRA_ARTWORKS_NUM = "TIER_EXTRA_ARTWORKS_NUM";
    string constant ATTRIBUTE_TIER_RANDOM_MINT = "TIER_RANDOM_MINT";
    string constant ATTRIBUTE_TIER_RANDOM_SHUFFLE_MINT = "TIER_RANDOM_SHUFFLE_MINT";

    string constant ATTRIBUTE_MAX_AMOUNT = "MAX_AMOUNT";
    string constant ATTRIBUTE_TOTAL_AMOUNT = "TOTAL_AMOUNT";
    string constant ATTRIBUTE_IS_TRANSFERABLE = "IS_TRANSFERABLE";
    string constant ATTRIBUTE_UNLOCKS_AT_HOURS = "TRANSFER_UNLOCKS_AT_HOURS";
    string constant BURN_POLICY_ERROR = "BURN_POLICY_ERROR";

    bytes32 private constant gasKeyHash = 0x6e099d640cde6de9d40ac749b4b594126b0169747122711109c9985d47751f93;
    uint32 private constant callbackGasLimit = 500000;
    uint32 private constant numWords = 1;
    uint16 private constant requestConfirmations = 3;

    string public baseURI;

    bool private __0; // @param removed: isTransferable
    uint32 private __1; // @param removed: transferUnlocksAtHours
    uint32 internal _nextTokenId;

    mapping(uint32 => Properties) internal _propertiesByTokenId;
    // @param Mapping from KeyHash to mapping Attributes
    mapping(KeyHash => mapping(bytes32 => Attributes)) internal _attributesByPropertyKey;

    mapping(bytes32 => uint32[]) internal _randomShuffleUnusedArtworkIds;

    string private _editableName;
    string private _editableSymbol;
    bool private _restrictBurnPolicy;
    VRFCoordinatorV2Interface private vrfCoordinator;
    uint64 private subscriptionId;
    mapping(uint256 => VRFRequest) internal requests;

    event SetAttribute(string propKey, bytes32 propValue, string attrKey, bytes32 attrValue);
    event Mint(uint32 tokenId, string[] propKeys, bytes32[] propValues);
    event Burn(uint32 tokenId);
    event SetName(string name);
    event SetSymbol(string symbol);
    event SetBaseURI(string uri);

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    function _msgSender() internal view override(ContextUpgradeable, ERC2771Context) returns (address sender) {
        sender = ERC2771Context._msgSender();
    }

    // @dev Corresponds if contexts is both upgradeable and suits ERC2771
    function _msgData() internal view override(ContextUpgradeable, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function initialize(Initialization calldata init) external initializer {
        _transferOwnership(init.openseaOwner);

        __ERC721_init(init.name, init.symbol);
        __App_init(init.kernel);

        baseURI = init.baseURI;
        _editableName = init.name;
        _editableSymbol = init.symbol;
        emit SetBaseURI(baseURI);
        emit SetName(_editableName);
        emit SetSymbol(_editableSymbol);
    }

    function contractURI() external view returns (string memory) {
        return string(abi.encodePacked(baseURI, "contract"));
    }

    function hasRandomMint(bytes32 tier) public view returns (bool) {
        return _getAttribute(PROPERTY_TIER, tier, ATTRIBUTE_TIER_RANDOM_MINT) == bytes32(bytes1(0x01));
    }

    function hasRandomShuffleMint(bytes32 tier) public view returns (bool) {
        return _getAttribute(PROPERTY_TIER, tier, ATTRIBUTE_TIER_RANDOM_SHUFFLE_MINT) == bytes32(bytes1(0x01));
    }

    function tierExtraArtworksNum(bytes32 tier) public view returns (uint256) {
        return uint256(_getAttribute(PROPERTY_TIER, tier, ATTRIBUTE_TIER_EXTRA_ARTWORKS_NUM));
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        uint32 tokenIdU32 = uint32(tokenId);
        bytes32 tier = _getPropertyValue(tokenIdU32, PROPERTY_TIER);
        if (tierExtraArtworksNum(tier) != 0) {
            uint256 artworkId = uint256(_getPropertyValue(tokenIdU32, PROPERTY_ARTWORK_ID));
            return string(abi.encodePacked(baseURI, Utils.bytes32ToString(tier), "/", artworkId.toString()));
        } else {
            return string(abi.encodePacked(baseURI, Utils.bytes32ToString(tier)));
        }
    }

    function getAttribute(
        string memory propKey,
        bytes32 propValue,
        string memory attrKey
    ) external view returns (bytes32) {
        return _getAttribute(propKey, propValue, attrKey);
    }

    function getPropertyValue(uint32 tokenId, string calldata key) external view returns (bytes32) {
        return _getPropertyValue(tokenId, key);
    }

    function setBaseURI(string calldata uri) external requirePermission(CONTROLLER) {
        baseURI = uri;
        emit SetBaseURI(uri);
    }

    function setRestrictBurnPolicy(bool burnPolicy) external requirePermission(CONTROLLER) {
        _restrictBurnPolicy = burnPolicy;
    }

    function getRestrictBurnPolicy() external view returns (bool) {
        return _restrictBurnPolicy;
    }

    function setupVRF(VRFCoordinatorV2Interface _vrfCoordinator, uint64 _subscriptionId)
        external
        requirePermission(CONTROLLER)
    {
        vrfCoordinator = _vrfCoordinator;
        subscriptionId = _subscriptionId;
    }

    function setRandomShuffleMint(bytes32 tierValue, uint256 tokenCount) external requirePermission(CONTROLLER) {
        require(tokenCount > 1); // otherwise it's a `one-of-many`
        require(tokenCount <= 5000); // TODO: to avoid block gas limit; add iterative initialization in the future
        require(!hasRandomMint(tierValue) && !hasRandomShuffleMint(tierValue)); // TODO: -1 SLOAD
        _setAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TIER_RANDOM_SHUFFLE_MINT, bytes32(bytes1(0x01)));
        _setAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_MAX_AMOUNT, bytes32(tokenCount));
        _setAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TIER_EXTRA_ARTWORKS_NUM, bytes32(tokenCount - 1));
        _randomShuffleUnusedArtworkIds[tierValue] = new uint32[](tokenCount);
        uint32[] storage ids = _randomShuffleUnusedArtworkIds[tierValue];
        for (uint256 i; i != tokenCount; ++i) {
            ids[i] = uint32(i);
        }
    }

    function setRandomMint(
        bytes32 tierValue,
        uint256 tokenCount,
        uint256 artworksCount
    ) external requirePermission(CONTROLLER) {
        require(artworksCount > 1); // otherwise it's a `one-of-many`
        require(artworksCount <= 5000); // TODO: to avoid block gas limit; add iterative initialization in the future
        require(!hasRandomShuffleMint(tierValue) && !hasRandomMint(tierValue)); // TODO: -1 SLOAD
        _setAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TIER_RANDOM_MINT, bytes32(bytes1(0x01)));
        _setAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_MAX_AMOUNT, bytes32(tokenCount));
        _setAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TIER_EXTRA_ARTWORKS_NUM, bytes32(artworksCount - 1));
    }

    function mint(address to, bytes32 tierValue) external requirePermission(CONTROLLER) {
        // @dev default max amount is 0 so the tier --must-- be set & configured
        uint256 maxAmountByTier = uint256(_getAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_MAX_AMOUNT));
        uint256 totalAmountByTier = uint256(_getAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TOTAL_AMOUNT));
        bool randomMintByTier = hasRandomMint(tierValue);
        bool randomShuffleMintByTier = hasRandomShuffleMint(tierValue);

        require(totalAmountByTier < maxAmountByTier, INVALID_TIER_AMOUNT_ERROR);

        _setAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TOTAL_AMOUNT, bytes32(++totalAmountByTier));
        _propertiesByTokenId[_nextTokenId].properties[_calculateKeyHash(PROPERTY_TIER)] = tierValue;

        uint32 tokenId = _nextTokenId;
        _nextTokenId++;

        if (randomShuffleMintByTier || randomMintByTier) {
            if (address(vrfCoordinator) != address(0)) {
                uint256 requestId = vrfCoordinator.requestRandomWords(
                    gasKeyHash,
                    subscriptionId,
                    requestConfirmations,
                    callbackGasLimit,
                    numWords
                );
                requests[requestId] = VRFRequest({to: to, tierValue: tierValue, tokenId: tokenId});
            } else {
                uint256 rand = Utils.pseudorand(abi.encodePacked(to));
                _randomMint(rand, to, tokenId, tierValue);
            }
        } else {
            _mintWithProperties(to, tokenId, tierValue, bytes32(0));
        }
    }

    function burn(uint32 tokenId) external requirePermission(CONTROLLER) {
        _burn(tokenId);

        KeyHash propertyTierKey = _calculateKeyHash(PROPERTY_TIER);
        bytes32 tierValue = _propertiesByTokenId[tokenId].properties[propertyTierKey];
        uint256 totalAmountByTier = uint256(_getAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TOTAL_AMOUNT));
        _setAttribute(PROPERTY_TIER, tierValue, ATTRIBUTE_TOTAL_AMOUNT, bytes32(--totalAmountByTier));

        _propertiesByTokenId[tokenId].properties[propertyTierKey] = bytes32(0);
        emit Burn(tokenId);
    }

    function setAttribute(
        string memory propKey,
        bytes32 propValue,
        string memory attrKey,
        bytes32 attrValue
    ) external requirePermission(CONTROLLER) {
        _setAttribute(propKey, propValue, attrKey, attrValue);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal view override {
        require(to != address(0) || !_restrictBurnPolicy, BURN_POLICY_ERROR);

        if (from != address(0) && to != address(0)) {
            bytes32 propValue = _getPropertyValue(uint32(tokenId), PROPERTY_TIER);
            uint256 isTransferable = uint256(_getAttribute(PROPERTY_TIER, propValue, ATTRIBUTE_IS_TRANSFERABLE));
            uint256 unlockTransferTimestamp = uint256(
                _getAttribute(PROPERTY_TIER, propValue, ATTRIBUTE_UNLOCKS_AT_HOURS)
            );
            require(isTransferable == 1 && block.timestamp / 1 hours > unlockTransferTimestamp);
        }
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function _setAttribute(
        string memory propKey,
        bytes32 propValue,
        string memory attrKey,
        bytes32 attrValue
    ) internal {
        _attributesByPropertyKey[_calculateKeyHash(propKey)][propValue].attributes[
            _calculateKeyHash(attrKey)
        ] = attrValue;

        emit SetAttribute(propKey, propValue, attrKey, attrValue);
    }

    function _getAttribute(
        string memory propKey,
        bytes32 propValue,
        string memory attrKey
    ) internal view returns (bytes32) {
        return _attributesByPropertyKey[_calculateKeyHash(propKey)][propValue].attributes[_calculateKeyHash(attrKey)];
    }

    function _getPropertyValue(uint32 tokenId, string memory key) internal view returns (bytes32) {
        return _propertiesByTokenId[tokenId].properties[_calculateKeyHash(key)];
    }

    function _calculateKeyHash(string memory key) private pure returns (KeyHash) {
        return KeyHash.wrap(keccak256(abi.encodePacked(key)));
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal {
        VRFRequest memory req = requests[requestId];
        _randomMint(randomWords[0], req.to, req.tokenId, req.tierValue);
    }

    function _randomMint(
        uint256 rand,
        address to,
        uint32 tokenId,
        bytes32 tierValue
    ) internal {
        bytes32 artworkIdPropValue;
        uint256 extraArtworksNumByTier = tierExtraArtworksNum(tierValue);
        bool randomShuffleMintByTier = hasRandomShuffleMint(tierValue);
        bool randomMintByTier = hasRandomMint(tierValue);
        if (randomMintByTier) {
            uint256 artworkId = rand;
            artworkIdPropValue = bytes32(artworkId % (extraArtworksNumByTier + 1));
        } else if (randomShuffleMintByTier) {
            // Knuth random shuffle
            uint32[] storage ids = _randomShuffleUnusedArtworkIds[tierValue];
            uint256 len = ids.length;
            uint256 rnd = rand;
            uint256 ptr = ids[rnd % len];
            uint256 val = ids[ptr];
            (ids[ptr], ids[len - 1]) = (ids[len - 1], ids[ptr]);
            delete ids[len - 1];
            ids.pop();
            artworkIdPropValue = bytes32(val);
        }

        _mintWithProperties(to, tokenId, tierValue, artworkIdPropValue);
    }

    function _mintWithProperties(
        address to,
        uint32 tokenId,
        bytes32 tierValue,
        bytes32 artworkIdPropValue
    ) internal {
        string[] memory propKeys = new string[](2);
        bytes32[] memory propValues = new bytes32[](2);
        propKeys[0] = PROPERTY_TIER;
        propKeys[1] = PROPERTY_ARTWORK_ID;
        propValues[0] = tierValue;
        propValues[1] = artworkIdPropValue;
        _propertiesByTokenId[tokenId].properties[_calculateKeyHash(PROPERTY_ARTWORK_ID)] = artworkIdPropValue;

        _mint(to, tokenId);

        emit Mint(tokenId, propKeys, propValues);
    }

    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        require(msg.sender == address(vrfCoordinator), "");
        fulfillRandomWords(requestId, randomWords);
    }

    function setName(string calldata name_) external requirePermission(CONTROLLER) {
        _editableName = name_;
        emit SetName(_editableName);
    }

    function setSymbol(string calldata symbol_) external requirePermission(CONTROLLER) {
        _editableSymbol = symbol_;
        emit SetSymbol(_editableSymbol);
    }

    function name() public view override returns (string memory) {
        return _editableName;
    }

    function symbol() public view override returns (string memory) {
        return _editableSymbol;
    }
}
