export const CONTRACT_CONFIG = {
  address: process.env.CONTRACT_ADDRESS || '',
  rpcUrl: process.env.RPC_URL || '',
  abi: [
    'function getRandomSeedStatus() external view returns (uint256 randomSeed, bool isRevealed)',
    'function maxSupply() external view returns (uint64)',
    'function totalSupply() external view returns (uint256)',
    'event RandomSeedSet(uint256 randomSeed)'
  ]
}

export const METADATA_CONFIG = {
  baseUri: process.env.METADATA_BASE_URI || 'https://your-domain.com/metadata/',
  suffix: process.env.METADATA_SUFFIX || '.json'
}
