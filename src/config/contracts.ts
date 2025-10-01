export const CONTRACT_CONFIG = {
  address: '0x0af5263b4cFfe4F71272d3d2acB7bbB1add056cC',
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
