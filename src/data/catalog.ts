import { readFileSync } from 'fs'
import path from 'path'

export const EXPECTED_SUPPLY = 2197

export interface TokenMetadata {
  name: string
  description: string
  image: string
  external_url?: string
  animation_url?: string
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
}

export interface CatalogItem {
  tokenId: number
  metadataId: number
  boxTypeId: number | null
  isRevealed: boolean
  metadata: TokenMetadata
}

export interface NftInfo {
  tokenId: number
  metadataId: number
  isRevealed: boolean
  boxTypeId: number | null
  metadata: TokenMetadata
}

export interface CatalogStats {
  totalNfts: number
  revealedNfts: number
  unrevealedNfts: number
}

interface CatalogFile {
  count: number
  revealedCount: number
  unrevealedCount: number
  items: CatalogItem[]
}

const byTokenId = new Map<number, CatalogItem>()
const byMetadataId = new Map<number, CatalogItem>()
let stats: CatalogStats = {
  totalNfts: 0,
  revealedNfts: 0,
  unrevealedNfts: 0
}
let loaded = false

export function loadCatalog(): void {
  const catalogPath = path.join(process.cwd(), 'data/slash206-zei-6-metadata.json')
  let raw: string
  try {
    raw = readFileSync(catalogPath, 'utf8')
  } catch {
    throw new Error(`Metadata catalog not found at ${catalogPath}`)
  }

  const file = JSON.parse(raw) as CatalogFile
  if (!Array.isArray(file.items) || file.count !== EXPECTED_SUPPLY || file.items.length !== EXPECTED_SUPPLY) {
    throw new Error(
      `Metadata catalog invalid: expected ${EXPECTED_SUPPLY} items, got count=${file.count} items=${file.items?.length}`
    )
  }

  byTokenId.clear()
  byMetadataId.clear()

  for (const item of file.items) {
    if (!item || typeof item.tokenId !== 'number' || typeof item.metadataId !== 'number' || !item.metadata) {
      throw new Error('Metadata catalog contains an invalid item')
    }
    if (byTokenId.has(item.tokenId) || byMetadataId.has(item.metadataId)) {
      throw new Error(`Duplicate tokenId or metadataId in catalog: token ${item.tokenId}`)
    }
    byTokenId.set(item.tokenId, item)
    byMetadataId.set(item.metadataId, item)
  }

  stats = {
    totalNfts: file.count,
    revealedNfts: file.revealedCount,
    unrevealedNfts: file.unrevealedCount
  }
  loaded = true
}

function assertLoaded(): void {
  if (!loaded) {
    throw new Error('Metadata catalog is not loaded')
  }
}

export function getByTokenId(tokenId: number): TokenMetadata | null {
  assertLoaded()
  return byTokenId.get(tokenId)?.metadata ?? null
}

export function getByMetadataId(metadataId: number): TokenMetadata | null {
  assertLoaded()
  return byMetadataId.get(metadataId)?.metadata ?? null
}

export function getNftInfo(tokenId: number): NftInfo | null {
  assertLoaded()
  const item = byTokenId.get(tokenId)
  if (!item) {
    return null
  }
  return {
    tokenId: item.tokenId,
    metadataId: item.metadataId,
    isRevealed: item.isRevealed,
    boxTypeId: item.boxTypeId,
    metadata: item.metadata
  }
}

export function getStats(): CatalogStats {
  assertLoaded()
  return stats
}
