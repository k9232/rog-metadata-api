import prisma from '../config/database'
import { METADATA_CONFIG } from '../config/contracts'
import { generatePhase2Signature, verifyPhase2Signature } from '../utils/crypto'

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
  async getTokenMetadataByMetadataId(metadataId: number): Promise<TokenMetadata | null> {
    const nftInfo = await prisma.nftInfo.findFirst({
      where: { metadataId }
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

  async getTokenMetadata(tokenId: number): Promise<TokenMetadata | null> {
    const nftInfo = await prisma.nftInfo.findUnique({
      where: { tokenId }
    })

    if (!nftInfo) {
      return null
    }

    return await this.getBlindBoxMetadata(nftInfo.boxTypeId)

    // TODO: 
    // if (nftInfo.originId === 0) {
    //   return await this.getBlindBoxMetadata(nftInfo.boxTypeId)
    // } else {
    //   return await this.getRevealedMetadata(nftInfo.originId)
    // }
  }

  async getBlindBoxMetadata(boxTypeId: number): Promise<TokenMetadata> {
    const unrevealMetadata = await prisma.unrevealMetadataInfo.findUnique({
      where: { boxTypeId }
    })

    if (unrevealMetadata) {
      return unrevealMetadata.metadata as unknown as TokenMetadata
    }

    throw new Error(`Blind box metadata not found for boxType ${boxTypeId}`)
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

  async addPhase2Holder(userAddress: string, boxTypeId: number, tokenId: number): Promise<void> {
    await prisma.phase2Holders.create({
      data: {
        id: tokenId,
        userAddress,
        boxTypeId
      }
    })
    console.log(`Added Phase2 holder: ${userAddress} for boxType ${boxTypeId}`)
  }

  /**
   * Generate and store signature for a Phase2 holder
   * @param userAddress - The wallet address of the holder
   * @param tokenId - The token ID to generate signature for
   * @param boxTypeId - The box type ID
   * @param signerPrivateKey - The private key to sign with
   * @returns The generated signature
   */
  async generateAndStorePhase2Signature(
    userAddress: string, 
    tokenId: number, 
    boxTypeId: number,
    signerPrivateKey: string
  ): Promise<string> {
    // Generate the signature
    const signature = generatePhase2Signature(userAddress, tokenId, signerPrivateKey)
    
    // Update the Phase2Holders record with the signature
    await prisma.phase2Holders.updateMany({
      where: {
        userAddress,
        boxTypeId
      },
      data: {
        signature
      }
    })
    
    console.log(`Generated and stored signature for Phase2 holder: ${userAddress}, tokenId: ${tokenId}`)
    return signature
  }

  /**
   * Get signature for a Phase2 holder
   * @param userAddress - The wallet address of the holder
   * @param boxTypeId - The box type ID
   * @returns The signature if found, null otherwise
   */
  async getPhase2HolderSignature(userAddress: string, boxTypeId: number): Promise<string | null> {
    const holder = await prisma.phase2Holders.findFirst({
      where: {
        userAddress,
        boxTypeId
      },
      select: {
        signature: true
      }
    })
    
    return holder?.signature || null
  }

  /**
   * Get all signatures for a Phase2 holder
   * @param userAddress - The wallet address of the holder
   * @returns Array of signatures with boxTypeId
   */
  async getPhase2HolderMintInfo(userAddress: string) {
    const holder = await prisma.phase2Holders.findFirst({
      where: {
        userAddress,
        signature: {
          not: null
        }
      }
    })
    
    return holder;
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

  async getPhase2HolderInfo(userAddress: string): Promise<{
    isPhase2Holder: boolean;
    address: string;
    boxTypeIds: number[];
  }> {
    const holders = await prisma.phase2Holders.findMany({
      where: {
        userAddress
      },
      select: {
        boxTypeId: true
      }
    })
    
    const boxTypeIds = holders.map(holder => holder.boxTypeId)
    
    return {
      isPhase2Holder: boxTypeIds.length > 0,
      address: userAddress,
      boxTypeIds
    }
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
