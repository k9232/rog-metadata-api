import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from '../config/contracts'
import prisma from '../config/database'

export class BlockchainService {
  private provider: ethers.Provider
  private contract: ethers.Contract

  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl)
    this.contract = new ethers.Contract(
      CONTRACT_CONFIG.address,
      CONTRACT_CONFIG.abi,
      this.provider
    )
  }

  async getRandomSeedStatus(): Promise<{ randomSeed: bigint; isRevealed: boolean }> {
    const [randomSeed, isRevealed] = await this.contract.getRandomSeedStatus()
    return {
      randomSeed: BigInt(randomSeed.toString()),
      isRevealed
    }
  }

  async getMaxSupply(): Promise<number> {
    const maxSupply = await this.contract.maxSupply()
    return Number(maxSupply)
  }

  async syncRandomSeedFromContract(): Promise<bigint | null> {
    try {
      const { randomSeed, isRevealed } = await this.getRandomSeedStatus()
      
      if (!isRevealed || randomSeed === 0n) {
        console.log('Random seed not yet revealed on contract')
        return null
      }

      const existing = await prisma.randomSeedInfo.findUnique({
        where: { randomSeed: randomSeed.toString() }
      })

      if (!existing) {
        await prisma.randomSeedInfo.create({
          data: {
            randomSeed: randomSeed.toString(),
            syncedAt: new Date()
          }
        })
        console.log(`Synced new random seed: ${randomSeed.toString()}`)
      }

      return randomSeed
    } catch (error) {
      console.error('Error syncing random seed:', error)
      throw error
    }
  }

  async startEventListener(onRandomSeedSet: (randomSeed: bigint) => Promise<void>): Promise<void> {
    this.contract.on('RandomSeedSet', async (randomSeed: bigint) => {
      console.log(`RandomSeedSet event detected: ${randomSeed.toString()}`)
      
      const existing = await prisma.randomSeedInfo.findUnique({
        where: { randomSeed: randomSeed.toString() }
      })

      if (!existing) {
        await prisma.randomSeedInfo.create({
          data: {
            randomSeed: randomSeed.toString(),
            syncedAt: new Date()
          }
        })
        console.log(`Stored random seed from event: ${randomSeed.toString()}`)
        
        await onRandomSeedSet(randomSeed)
      }
    })
    
    console.log('Started listening for RandomSeedSet events')
  }
}
