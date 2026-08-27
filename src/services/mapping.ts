import { zeroAddress } from 'viem';
import prisma from '../config/database'
import { calculateMetadataId } from '../utils/crypto'

export class MappingService {
  async generateAllMappings(randomSeed: bigint, maxSupply: number): Promise<void> {


    const lastNftInfo = await prisma.nftInfo.findFirst({
      orderBy: { tokenId: 'desc' }
    })
    if(lastNftInfo) {
      const lastTokenId = lastNftInfo.tokenId + 1;
      const newNftInfos: any[] = [];
      for(let i = lastTokenId; i <= maxSupply; i++) {
        const metadataId = calculateMetadataId(i, randomSeed, maxSupply)
        newNftInfos.push({ 
          tokenId: i,
          metadataId: metadataId,
          boxTypeId: 3,
          userAddress: zeroAddress,
          originId: 0,
          createdAt: new Date()
        })
      }
      await prisma.nftInfo.createMany({
        data: newNftInfos
      })
      console.log(`Generated mappings for ${maxSupply - lastNftInfo.tokenId} NFTs`)

      throw new Error('Stop here')
    }

    console.log(`Generating mappings for ${maxSupply} tokens with seed: ${randomSeed.toString()}`)

    const existingNfts = await prisma.nftInfo.findMany({
      orderBy: { tokenId: 'asc' }
    })

    if (existingNfts.length === 0) {
      console.log('No existing NFTs found, skipping mapping generation')
      return
    }
    for (const nft of existingNfts) {
      const metadataId = calculateMetadataId(nft.tokenId, randomSeed, maxSupply)

      if(!nft.metadataId) {
        await prisma.nftInfo.update({
          where: { tokenId: nft.tokenId },
          data: { metadataId }
        })
        console.log(`Updated NFT ${nft.tokenId} with metadataId ${metadataId}`)
      }
    }
    await prisma.randomSeedInfo.upsert({
      where: { randomSeed: randomSeed.toString() },
      update: { mappingsGenerated: true },
      create: { randomSeed: randomSeed.toString(), mappingsGenerated: true }
    });
    console.log('✅ Mappings generated for existing NFTs')
    return;

    await prisma.$transaction(async (tx: any) => {
      for (const nft of existingNfts) {
        const metadataId = calculateMetadataId(nft.tokenId, randomSeed, maxSupply)

        await tx.nftInfo.update({
          where: { tokenId: nft.tokenId },
          data: { metadataId }
        })

        // const availableOrigin = await tx.originMetadataInfo.findFirst({
        //   where: {
        //     boxTypeId: nft.boxTypeId,
        //     isAssigned: false
        //   },
        //   orderBy: { originId: 'asc' }
        // })

        // if (availableOrigin) {
        //   await tx.nftInfo.update({
        //     where: { tokenId: nft.tokenId },
        //     data: {
        //       metadataId,
        //       originId: availableOrigin.originId
        //     }
        //   })

        //   await tx.originMetadataInfo.update({
        //     where: { originId: availableOrigin.originId },
        //     data: { isAssigned: true }
        //   })

        //   console.log(`Token ${nft.tokenId} -> MetadataId ${metadataId}, OriginId ${availableOrigin.originId}`)
        // } else {
        //   console.warn(`No available origin metadata for boxType ${nft.boxTypeId}`)
        // }
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
        originId: 0
      }
    })
    console.log(`Created NFT info for token ${data.tokenId}, boxType ${data.boxTypeId}`)
  }
}
