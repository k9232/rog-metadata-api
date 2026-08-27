import {
  getByMetadataId,
  getByTokenId,
  getNftInfo as getCatalogNftInfo,
  getStats as getCatalogStats,
  NftInfo,
  CatalogStats,
  TokenMetadata
} from '../data/catalog'

export type { TokenMetadata, NftInfo, CatalogStats }

export class MetadataService {
  getTokenMetadata(tokenId: number): TokenMetadata | null {
    return getByTokenId(tokenId)
  }

  getTokenMetadataByMetadataId(metadataId: number): TokenMetadata | null {
    return getByMetadataId(metadataId)
  }

  getNftInfo(tokenId: number): NftInfo | null {
    return getCatalogNftInfo(tokenId)
  }

  getStats(): CatalogStats {
    return getCatalogStats()
  }
}
