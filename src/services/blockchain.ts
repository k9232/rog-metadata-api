import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from '../config/contracts'
import prisma from '../config/database'

export class BlockchainService {
  private provider: ethers.Provider | null = null
  private contract: ethers.Contract | null = null
  private isConfigured: boolean = false

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    try {
      // Validate configuration
      if (!CONTRACT_CONFIG.rpcUrl || CONTRACT_CONFIG.rpcUrl === '') {
        console.warn('⚠️ RPC_URL not configured, blockchain features will be disabled')
        return
      }

      if (!CONTRACT_CONFIG.address || CONTRACT_CONFIG.address === '' || CONTRACT_CONFIG.address === '0x0000000000000000000000000000000000000000') {
        console.warn('⚠️ CONTRACT_ADDRESS not configured or invalid, blockchain features will be disabled')
        return
      }

      // Initialize provider and contract
      this.provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl)
      this.contract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        CONTRACT_CONFIG.abi,
        this.provider
      )
      this.isConfigured = true
      console.log('✅ Blockchain service initialized successfully')
    } catch (error) {
      console.warn('⚠️ Failed to initialize blockchain service:', error)
      this.isConfigured = false
    }
  }

  private checkConfiguration(): void {
    if (!this.isConfigured || !this.contract) {
      throw new Error('Blockchain service not properly configured. Please check CONTRACT_ADDRESS and RPC_URL environment variables.')
    }
  }

  async getRandomSeedStatus(): Promise<{ randomSeed: bigint; isRevealed: boolean }> {
    this.checkConfiguration()
    const [randomSeed, isRevealed] = await this.contract!.getRandomSeedStatus()
    return {
      randomSeed: BigInt(randomSeed.toString()),
      isRevealed
    }
  }

  async getMaxSupply(): Promise<number> {
    this.checkConfiguration()
    const maxSupply = await this.contract!.maxSupply()
    return Number(maxSupply)
  }

  async getOwnerOf(tokenId: number): Promise<string> {
    this.checkConfiguration()
    const owner = await this.contract!.ownerOf(tokenId)
    return owner
  }

  async syncRandomSeedFromContract(): Promise<bigint | null> {
    try {
      this.checkConfiguration()
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
    this.checkConfiguration()
    this.contract!.on('RandomSeedSet', async (randomSeed: bigint) => {
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

  async startTransferEventListener(onTransfer: (from: string, to: string, tokenId: bigint) => Promise<void>): Promise<void> {
    this.checkConfiguration()
    this.contract!.on('Transfer', async (from: string, to: string, tokenId: bigint) => {
      console.log(`Transfer event detected: from=${from}, to=${to}, tokenId=${tokenId.toString()}`)
      await onTransfer(from, to, tokenId)
    })
    
    console.log('Started listening for Transfer events')
  }

  async getLatestBlockNumber(): Promise<number> {
    this.checkConfiguration()
    const blockNumber = await this.provider!.getBlockNumber()
    return blockNumber
  }

  async getTransferEvents(fromBlock: number, toBlock?: number): Promise<Array<{
    from: string;
    to: string;
    tokenId: bigint;
    blockNumber: number;
    transactionHash: string;
  }>> {
    this.checkConfiguration()
    
    const filter = this.contract!.filters.Transfer()
    const events = await this.contract!.queryFilter(filter, fromBlock, toBlock)
    
    return events.map(event => {
      // Type guard to ensure we have an EventLog with args
      if ('args' in event && event.args) {
        return {
          from: event.args[0] as string,
          to: event.args[1] as string,
          tokenId: BigInt(event.args[2].toString()),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        }
      }
      throw new Error('Invalid event format')
    })
  }

  isServiceConfigured(): boolean {
    return this.isConfigured
  }
}
