import prisma from '../config/database'
import { calculateMetadataId } from '../utils/crypto'

export class MappingService {
  async generateAllMappings(randomSeed: bigint, maxSupply: number): Promise<void> {
    console.log(`Generating mappings for ${maxSupply} tokens with seed: ${randomSeed.toString()}`)

    // 獲取所有已存在的 NFT
    const existingNfts = await prisma.nftInfo.findMany({
      orderBy: { tokenId: 'asc' }
    })

    if (existingNfts.length === 0) {
      console.log('No existing NFTs found, skipping mapping generation')
      return
    }

    await prisma.$transaction(async (tx: any) => {
      // 為每個 NFT 生成 metadataId 並分配 originId
      for (const nft of existingNfts) {
        const metadataId = calculateMetadataId(nft.tokenId, randomSeed, maxSupply)
        
        // 找一個未分配的 originId (相同 boxType)
        const availableOrigin = await tx.originMetadataInfo.findFirst({
          where: {
            boxTypeId: nft.boxTypeId,
            isAssigned: false
          },
          orderBy: { originId: 'asc' }
        })

        if (availableOrigin) {
          // 更新 NFT 的 metadataId 和 originId
          await tx.nftInfo.update({
            where: { tokenId: nft.tokenId },
            data: {
              metadataId,
              originId: availableOrigin.originId
            }
          })

          // 標記 origin metadata 為已分配
          await tx.originMetadataInfo.update({
            where: { originId: availableOrigin.originId },
            data: { isAssigned: true }
          })

          console.log(`Token ${nft.tokenId} -> MetadataId ${metadataId}, OriginId ${availableOrigin.originId}`)
        } else {
          console.warn(`No available origin metadata for boxType ${nft.boxTypeId}`)
        }
      }
      
      await tx.randomSeedInfo.update({
        where: { randomSeed: randomSeed.toString() },
        data: { mappingsGenerated: true }
      })
    })

    console.log(`Generated mappings for ${existingNfts.length} NFTs`)
  }

  async getNftInfo(tokenId: number): Promise<any> {
    return await prisma.nftInfo.findUnique({
      where: { tokenId }
    })
  }

  async createNftInfo(data: {
    tokenId: number
    userAddress: string
    boxTypeId: number
  }): Promise<void> {
    await prisma.nftInfo.create({
      data: {
        tokenId: data.tokenId,
        userAddress: data.userAddress,
        boxTypeId: data.boxTypeId,
        originId: 0 // 默認未解盲
      }
    })
    console.log(`Created NFT info for token ${data.tokenId}, boxType ${data.boxTypeId}`)
  }
}
