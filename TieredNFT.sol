// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract TieredNFT is ERC721, Ownable {
    using ECDSA for bytes32;

    bool public saleIsActive = false;
    address public gameSigner;   // Oyun sunucunuzun imza adresi
    
    string private baseTokenURI;

    struct Tier {
        uint256 price;
        uint16 totalSupply;
        uint16 maxSupply;
        uint16 startingIndex;
        uint8 mintsPerAddress;
        uint256 minScore;
        uint256 maxScore;
    }

    mapping(uint256 => Tier) public tiers;
    mapping(uint256 => mapping(address => uint256)) public addressCountsPerTier;
    mapping(address => uint256) public scoreOf;

    event TierMinted(address indexed minter, uint256 indexed tier, uint256 tokenId, uint256 score);
    event ScoreUpdated(address indexed user, uint256 newScore);
    event GameSignerUpdated(address indexed oldSigner, address indexed newSigner);

    modifier onlyExistingTier(uint256 tier) {
        require(tier < 8, "Tier does not exist");
        _;
    }

    constructor(
        string memory name, 
        string memory symbol,
        string memory _baseTokenURI,
        address _gameSigner
    ) ERC721(name, symbol) {
        baseTokenURI = _baseTokenURI;
        gameSigner = _gameSigner;
        
        uint256 p = 0.1 ether;
        
        // Initialize tiers with minScore and maxScore ranges
        // Tier 0: Mythic (20000+)
        tiers[0] = Tier(p, 0, 10, 0, 1, 20000, type(uint256).max);
        
        // Tier 1: Legendary (17500-19999)
        tiers[1] = Tier(p, 0, 25, 10, 1, 17500, 20000);
        
        // Tier 2: Diamond (15000-17499)
        tiers[2] = Tier(p, 0, 40, 35, 1, 15000, 17500);
        
        // Tier 3: Platinum (12500-14999)
        tiers[3] = Tier(p, 0, 50, 75, 1, 12500, 15000);
        
        // Tier 4: Gold (10000-12499)
        tiers[4] = Tier(p, 0, 100, 125, 1, 10000, 12500);
        
        // Tier 5: Silver (7500-9999)
        tiers[5] = Tier(p, 0, 200, 225, 1, 7500, 10000);
        
        // Tier 6: Bronze (4500-7499)
        tiers[6] = Tier(p, 0, 1000, 425, 1, 4500, 7500);
        
        // Tier 7: Regular (750-4499)
        tiers[7] = Tier(p, 0, 9999, 1425, 1, 750, 4500);
    }

    /// @notice Owner can update the game signer address
    function setGameSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer address");
        address oldSigner = gameSigner;
        gameSigner = _signer;
        emit GameSignerUpdated(oldSigner, _signer);
    }

    /// @notice Toggle sale state
    function flipSaleState() external onlyOwner {
        saleIsActive = !saleIsActive;
    }

    /// @notice Set base URI for metadata
    function setBaseURI(string calldata _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    /// @notice Main mint function - requires game signature
    /// @param tier The tier to mint (0-7)
    /// @param signature Signature from game backend authorizing this mint
    function mint(uint256 tier, bytes calldata signature)
        external
        payable
        onlyExistingTier(tier)
    {
        require(saleIsActive, "Sale not active");
        Tier storage t = tiers[tier];
        require(msg.value == t.price, "Send exactly 0.1 ether");

        // SIGNATURE VERIFICATION - This is the key security feature!
        // Create the same message that was signed by the game backend
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, tier));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        
        require(recoveredSigner == gameSigner, "Invalid or missing game signature");

        // SCORE RANGE CHECK - User must be in correct tier range
        uint256 userScore = scoreOf[msg.sender];
        require(
            userScore >= t.minScore && userScore < t.maxScore,
            "Score not in this tier range"
        );

        // SUPPLY AND LIMIT CHECKS
        require(t.totalSupply + 1 <= t.maxSupply, "Tier sold out");
        require(
            addressCountsPerTier[tier][msg.sender] + 1 <= t.mintsPerAddress,
            "Mint limit reached for this tier"
        );

        // EXECUTE MINT
        addressCountsPerTier[tier][msg.sender] += 1;
        uint16 offset = t.totalSupply;
        t.totalSupply += 1;
        uint256 tokenId = t.startingIndex + offset;
        
        _safeMint(msg.sender, tokenId);
        
        emit TierMinted(msg.sender, tier, tokenId, userScore);
    }

    /// @notice Batch update user scores (only owner)
    function batchSetScores(address[] calldata users, uint256[] calldata scores) 
        external 
        onlyOwner 
    {
        require(users.length == scores.length, "Arrays length mismatch");
        require(users.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < users.length; i++) {
            require(users[i] != address(0), "Invalid user address");
            scoreOf[users[i]] = scores[i];
            emit ScoreUpdated(users[i], scores[i]);
        }
    }

    /// @notice Get user's eligible tier based on their score
    function getUserTier(address user) public view returns (uint256) {
        uint256 userScore = scoreOf[user];
        
        for (uint256 i = 0; i < 8; i++) {
            if (userScore >= tiers[i].minScore && userScore < tiers[i].maxScore) {
                return i;
            }
        }
        
        revert("No eligible tier for this score");
    }

    /// @notice Check if user can mint a specific tier
    function canMintTier(address user, uint256 tier) 
        public 
        view 
        onlyExistingTier(tier) 
        returns (bool) 
    {
        if (!saleIsActive) return false;
        
        Tier storage t = tiers[tier];
        uint256 userScore = scoreOf[user];
        
        // Check score range
        if (userScore < t.minScore || userScore >= t.maxScore) return false;
        
        // Check supply
        if (t.totalSupply >= t.maxSupply) return false;
        
        // Check per-address limit
        if (addressCountsPerTier[tier][user] >= t.mintsPerAddress) return false;
        
        return true;
    }

    /// @notice Get tier information
    function getTierInfo(uint256 tier) 
        external 
        view 
        onlyExistingTier(tier) 
        returns (
            uint256 price,
            uint16 totalSupply,
            uint16 maxSupply,
            uint256 minScore,
            uint256 maxScore,
            uint8 mintsPerAddress
        ) 
    {
        Tier storage t = tiers[tier];
        return (t.price, t.totalSupply, t.maxSupply, t.minScore, t.maxScore, t.mintsPerAddress);
    }

    /// @notice Override tokenURI to use base URI
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "URI query for nonexistent token");
        return string(abi.encodePacked(baseTokenURI, Strings.toString(tokenId)));
    }

    /// @notice Emergency withdrawal function
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /// @notice Get total number of tiers
    function getTotalTiers() external pure returns (uint256) {
        return 8;
    }
}
