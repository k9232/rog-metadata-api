export const CONTRACT_CONFIG = {
  address: '0x471C2c840B69EB92523B1De0EEA791Ae1359AFd7',
  rpcUrl: process.env.RPC_URL || '',
  abi: [
    'function getRandomSeedStatus() external view returns (uint256 randomSeed, bool isRevealed)',
    'function maxSupply() external view returns (uint64)',
    'function totalSupply() external view returns (uint256)',
    'function ownerOf(uint256 tokenId) external view returns (address)',
    'event RandomSeedSet(uint256 randomSeed)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
  ]
}

export const METADATA_CONFIG = {
  baseUri: process.env.METADATA_BASE_URI || 'https://your-domain.com/metadata/',
  suffix: process.env.METADATA_SUFFIX || '.json'
}

const soulboundStartTime = new Date('2025-09-22T08:00:00.000Z');
const soulboundEndTime = new Date('2025-10-06T07:59:59.999Z');
const publicStartTime = new Date('2025-10-07T08:00:00.000Z');
const publicEndTime = new Date('2025-11-04T07:59:59.999Z');

export const MINT_CONFIG = {
  chainId: 1,
  maxSupply: 6020,
  nftAddress: CONTRACT_CONFIG.address,
  soulboundStartTime: soulboundStartTime.toISOString(),
  soulboundEndTime: soulboundEndTime.toISOString(),
  publicStartTime: publicStartTime.toISOString(),
  publicEndTime: publicEndTime.toISOString(),
  mintPrice: "0"
}

