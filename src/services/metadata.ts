import prisma from '../config/database'
import { METADATA_CONFIG } from '../config/contracts'

export interface TokenMetadata {
  name: string
  description: string
  image: string
  external_url?: string
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
}

export class MetadataService {
  async getTokenMetadata(tokenId: number): Promise<TokenMetadata | null> {
    const nftInfo = await prisma.nftInfo.findUnique({
      where: { tokenId }
    })

    if (!nftInfo) {
      return null
    }

    if (nftInfo.originId === 0) {
      return await this.getBlindBoxMetadata(nftInfo.boxTypeId)
    } else {
      return await this.getRevealedMetadata(nftInfo.originId)
    }
  }

  async getBlindBoxMetadata(boxTypeId: number): Promise<TokenMetadata> {
    const unrevealMetadata = await prisma.unrevealMetadataInfo.findUnique({
      where: { boxTypeId }
    })

    if (unrevealMetadata) {
      return unrevealMetadata.metadata as unknown as TokenMetadata
    }

    const boxTypeNames = ['金盒', '紅盒', '藍盒', '公售盒']
    return {
      name: `ROG Avatar ${boxTypeNames[boxTypeId] || '盲盒'}`,
      description: `這是一個未開啟的 ROG Avatar ${boxTypeNames[boxTypeId] || '盲盒'}，等待解盲中...`,
      image: `${METADATA_CONFIG.baseUri}blind-box/${boxTypeId}.png`,
      attributes: [
        {
          trait_type: 'Status',
          value: 'Unrevealed'
        },
        {
          trait_type: 'Box Type',
          value: boxTypeNames[boxTypeId] || `Type ${boxTypeId}`
        }
      ]
    }
  }

  async getRevealedMetadata(originId: number): Promise<TokenMetadata> {
    const originMetadata = await prisma.originMetadataInfo.findUnique({
      where: { originId }
    })

    if (!originMetadata) {
      throw new Error(`Origin metadata not found for originId: ${originId}`)
    }

    return originMetadata.metadata as unknown as TokenMetadata
  }

  async createBlindBoxMetadata(boxTypeId: number, metadata: TokenMetadata): Promise<void> {
    await prisma.unrevealMetadataInfo.upsert({
      where: { boxTypeId },
      update: { metadata: metadata as any },
      create: { boxTypeId, metadata: metadata as any }
    })
    console.log(`Created blind box metadata for boxType ${boxTypeId}`)
  }

  async createOriginMetadata(originId: number, boxTypeId: number, metadata: TokenMetadata): Promise<void> {
    await prisma.originMetadataInfo.create({
      data: {
        originId,
        boxTypeId,
        metadata: metadata as any,
        isAssigned: false
      }
    })
    console.log(`Created origin metadata for originId ${originId}, boxType ${boxTypeId}`)
  }

  async addPhase2Holder(userAddress: string, boxTypeId: number): Promise<void> {
    await prisma.phase2Holders.create({
      data: {
        userAddress,
        boxTypeId
      }
    })
    console.log(`Added Phase2 holder: ${userAddress} for boxType ${boxTypeId}`)
  }

  async isPhase2Holder(userAddress: string, boxTypeId: number): Promise<boolean> {
    const holder = await prisma.phase2Holders.findFirst({
      where: {
        userAddress,
        boxTypeId
      }
    })
    return !!holder
  }

  async getStats(): Promise<{
    totalNfts: number
    revealedNfts: number
    unrevealedNfts: number
    boxTypeStats: Array<{ boxTypeId: number; count: number; revealed: number }>
  }> {
    const totalNfts = await prisma.nftInfo.count()
    const revealedNfts = await prisma.nftInfo.count({
      where: { originId: { gt: 0 } }
    })

    const boxTypeStats = await prisma.nftInfo.groupBy({
      by: ['boxTypeId'],
      _count: {
        tokenId: true
      }
    })

    const boxTypeStatsWithRevealed = await Promise.all(
      boxTypeStats.map(async (stat: { boxTypeId: number; _count: { tokenId: number } }) => {
        const revealed = await prisma.nftInfo.count({
          where: {
            boxTypeId: stat.boxTypeId,
            originId: { gt: 0 }
          }
        })
        return {
          boxTypeId: stat.boxTypeId,
          count: stat._count.tokenId,
          revealed
        }
      })
    )

    return {
      totalNfts,
      revealedNfts,
      unrevealedNfts: totalNfts - revealedNfts,
      boxTypeStats: boxTypeStatsWithRevealed
    }
  }
}
