import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from '../config/contracts'
import prisma from '../config/database'

export class BlockchainService {
  private provider: ethers.Provider | null = null
  private contract: ethers.Contract | null = null
  private isConfigured: boolean = false
  private transferListenerActive: boolean = false
  private randomSeedListenerActive: boolean = false
  private errorHandlerSetup: boolean = false

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
      console.log('CONTRACT_CONFIG.address', CONTRACT_CONFIG.address)

      // Initialize provider and contract
      this.provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.rpcUrl)
      this.contract = new ethers.Contract(
        CONTRACT_CONFIG.address,
        CONTRACT_CONFIG.abi,
        this.provider
      )
      this.isConfigured = true
      // Set up global error handler for filter errors
      this.setupErrorHandler()
      
      console.log('✅ Blockchain service initialized successfully')
    } catch (error) {
      console.warn('⚠️ Failed to initialize blockchain service:', error)
      this.isConfigured = false
    }
  }

  private setupErrorHandler(): void {
    if (this.errorHandlerSetup || !this.provider) {
      return
    }

    // Suppress filter not found errors - these are expected when filters expire
    // ethers.js will automatically recreate the filter on next poll
    this.provider.on('error', (error: unknown) => {
      const err = error as { error?: { message?: string; code?: number }; code?: string }
      console.log('error!!', err)
      if (err?.error?.message?.includes('filter not found') || 
          (err?.code === 'UNKNOWN_ERROR' && err?.error?.code === -32000)) {
        // Silently ignore filter expiration errors - this is normal behavior
        return
      }
      // Log other errors
      console.error('Provider error:', error)
    })

    this.errorHandlerSetup = true
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

  async getTotalSupply(): Promise<number> {
    this.checkConfiguration()
    const totalSupply = await this.contract!.totalSupply()
    return Number(totalSupply)
  }

  async getOwnerOf(tokenId: number): Promise<string> {
    this.checkConfiguration()
    const owner = await this.contract!.ownerOf(tokenId)
    return owner
  }

  async syncRandomSeedFromContract(): Promise<{ randomSeed: bigint; needToGenerateMappings: boolean }> {
    try {
      this.checkConfiguration()
      let needToGenerateMappings = false;
      const { randomSeed, isRevealed } = await this.getRandomSeedStatus()
      
      if (!isRevealed || randomSeed === 0n) {
        console.log('Random seed not yet revealed on contract')
        return {
          randomSeed: 0n,
          needToGenerateMappings: false
        }
      }

      const existing = await prisma.randomSeedInfo.findUnique({
        where: { randomSeed: randomSeed.toString() }
      })

      if (!existing || (existing && existing.randomSeed !== randomSeed.toString())) {
        needToGenerateMappings = true;
        await prisma.randomSeedInfo.upsert({
          where: {
            id: 1,
          },
          create: {
            randomSeed: randomSeed.toString(),
            syncedAt: new Date()
          },
          update: {
            randomSeed: randomSeed.toString(),
            syncedAt: new Date()
          }
        })
        console.log(`Synced new random seed: ${randomSeed.toString()}`)
      }

      return {
        randomSeed,
        needToGenerateMappings
      }
    } catch (error) {
      console.error('Error syncing random seed:', error)
      throw error
    }
  }

  async startEventListener(onRandomSeedSet: (randomSeed: bigint) => Promise<void>): Promise<void> {
    this.checkConfiguration()
    
    if (this.randomSeedListenerActive) {
      console.log('RandomSeedSet listener already active')
      return
    }

    this.randomSeedListenerActive = true
    
    // Remove any existing listeners first
    this.contract!.removeAllListeners('RandomSeedSet')
    
    this.contract!.on('RandomSeedSet', async (randomSeed: bigint) => {
      try {
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
      } catch (error) {
        console.error('Error handling RandomSeedSet event:', error)
      }
    })
    
    console.log('Started listening for RandomSeedSet events')
  }

  stopEventListener(): void {
    if (this.contract) {
      this.contract.removeAllListeners('RandomSeedSet')
    }
    this.randomSeedListenerActive = false
    console.log('Stopped RandomSeedSet event listener')
  }

  async startTransferEventListener(onTransfer: (from: string, to: string, tokenId: bigint) => Promise<void>): Promise<void> {
    this.checkConfiguration()
    
    if (this.transferListenerActive) {
      console.log('Transfer listener already active')
      return
    }

    this.transferListenerActive = true
    
    // Remove any existing listeners first
    this.contract!.removeAllListeners('Transfer')
    
    this.contract!.on('Transfer', async (from: string, to: string, tokenId: bigint) => {
      try {
        console.log(`Transfer event detected: from=${from}, to=${to}, tokenId=${tokenId.toString()}`)
        await onTransfer(from, to, tokenId)
      } catch (error) {
        console.error('Error handling Transfer event:', error)
      }
    })
    
    console.log('Started listening for Transfer events')
  }

  stopTransferEventListener(): void {
    if (this.contract) {
      this.contract.removeAllListeners('Transfer')
    }
    this.transferListenerActive = false
    console.log('Stopped Transfer event listener')
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

  async getBlockTimestamp(blockNumber: number): Promise<number> {
    this.checkConfiguration()
    const block = await this.provider!.getBlock(blockNumber)
    if (!block) {
      throw new Error(`Block ${blockNumber} not found`)
    }
    return block.timestamp
  }

  isServiceConfigured(): boolean {
    return this.isConfigured
  }

  async getTokensOfOwner(address: string): Promise<Array<{
    tokenId: bigint;
    metadataId: number;
    metadata: any;
  }>> {
    this.checkConfiguration()
    const tokens = await this.contract!.tokensOfOwner(address)
    return tokens.map((tokenId: bigint) => Number(tokenId));
  }
}
