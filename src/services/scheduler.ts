/**
 * Scheduler Service for Random Seed Monitoring
 * 
 * This service provides functionality to periodically check for random seed
 * updates from the blockchain and automatically stop when found.
 */

import { BlockchainService } from './blockchain'
import { MappingService } from './mapping'
import { nftSyncService } from './nft-sync'
import prisma from '../config/database'

export class SchedulerService {
  private blockchainService: BlockchainService
  private mappingService: MappingService
  private intervalId: NodeJS.Timeout | null = null
  private nftSyncIntervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private isNftSyncRunning = false
  private checkInterval: number
  private nftSyncInterval: number

  constructor(checkIntervalMs: number = 30000, nftSyncIntervalMs: number = 60000) { // Default: 30s for random seed, 60s for NFT sync
    this.blockchainService = new BlockchainService()
    this.mappingService = new MappingService()
    this.checkInterval = checkIntervalMs
    this.nftSyncInterval = nftSyncIntervalMs
  }

  /**
   * Start periodic random seed monitoring
   */
  async startRandomSeedMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('Random seed monitoring is already running')
      return
    }

    console.log(`Starting random seed monitoring (checking every ${this.checkInterval}ms)`)
    this.isRunning = true

    // Check immediately first
    await this.checkRandomSeed()

    // Then check periodically
    this.intervalId = setInterval(async () => {
      await this.checkRandomSeed()
    }, this.checkInterval)
  }

  /**
   * Stop the random seed monitoring
   */
  stopRandomSeedMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('Random seed monitoring stopped')
  }

  /**
   * Check if monitoring is currently running
   */
  isMonitoring(): boolean {
    return this.isRunning
  }

  /**
   * Get current monitoring status
   */
  getStatus(): { 
    isRunning: boolean; 
    checkInterval: number;
    isNftSyncRunning: boolean;
    nftSyncInterval: number;
  } {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      isNftSyncRunning: this.isNftSyncRunning,
      nftSyncInterval: this.nftSyncInterval
    }
  }

  /**
   * Start NFT Transfer event monitoring and periodic sync
   */
  async startNftSyncMonitoring(): Promise<void> {
    if (this.isNftSyncRunning) {
      console.log('NFT sync monitoring is already running')
      return
    }

    console.log(`🎯 Starting NFT sync monitoring (checking every ${this.nftSyncInterval}ms)`)
    this.isNftSyncRunning = true

    // Start real-time Transfer event listener
    await nftSyncService.startTransferMonitoring()

    // Start periodic historical sync to catch any missed events
    this.nftSyncIntervalId = setInterval(async () => {
      await this.performHistoricalNftSync()
    }, this.nftSyncInterval)

    console.log('✅ NFT sync monitoring started')
  }

  /**
   * Stop NFT sync monitoring
   */
  stopNftSyncMonitoring(): void {
    if (this.nftSyncIntervalId) {
      clearInterval(this.nftSyncIntervalId)
      this.nftSyncIntervalId = null
    }
    
    nftSyncService.stopTransferMonitoring()
    this.isNftSyncRunning = false
    console.log('NFT sync monitoring stopped')
  }

  /**
   * Perform historical NFT sync to catch any missed events
   */
  private async performHistoricalNftSync(): Promise<void> {
    try {
      console.log('🔍 Performing historical NFT sync...')
      
      if (!this.blockchainService.isServiceConfigured()) {
        console.log('⏳ Blockchain service not configured, skipping NFT sync...')
        return
      }

      const syncStatus = await nftSyncService.getSyncStatus()
      
      if (syncStatus.blocksBehind > 0) {
        console.log(`📦 Syncing ${syncStatus.blocksBehind} blocks behind...`)
        const result = await nftSyncService.syncHistoricalEvents()
        console.log(`✅ Historical sync completed: ${result.processed} events processed, ${result.mints} mints, ${result.transfers} transfers`)
      } else {
        console.log('✅ NFT sync is up to date')
      }
      
    } catch (error) {
      console.error('❌ Error during historical NFT sync:', error)
    }
  }

  /**
   * Force NFT sync (useful for admin endpoints)
   */
  async forceNftSync(fromBlock?: number, toBlock?: number): Promise<{
    success: boolean;
    result?: any;
    message: string;
  }> {
    try {
      if (!this.blockchainService.isServiceConfigured()) {
        return {
          success: false,
          message: 'Blockchain service not configured. Please check CONTRACT_ADDRESS and RPC_URL environment variables.'
        }
      }

      const result = await nftSyncService.syncHistoricalEvents(fromBlock, toBlock)
      
      return {
        success: true,
        result,
        message: `NFT sync completed: ${result.processed} events processed, ${result.mints} mints, ${result.transfers} transfers`
      }
    } catch (error) {
      return {
        success: false,
        message: `Error during NFT sync: ${error}`
      }
    }
  }

  /**
   * Internal method to check random seed from blockchain
   */
  private async checkRandomSeed(): Promise<void> {
    try {
      console.log('Checking for random seed updates...')
      
      // Check if blockchain service is configured
      if (!this.blockchainService.isServiceConfigured()) {
        console.log('⏳ Blockchain service not configured, skipping random seed check...')
        return
      }
      
      // Check if we already have a synced random seed with mappings generated
      const existingSeed = await prisma.randomSeedInfo.findFirst({
        where: { mappingsGenerated: true },
        orderBy: { syncedAt: 'desc' }
      })

      if (existingSeed) {
        console.log(`Random seed already synced and mappings generated: ${existingSeed.randomSeed}`)
        this.stopRandomSeedMonitoring()
        return
      }

      // Try to sync from contract
      const randomSeed = await this.blockchainService.syncRandomSeedFromContract()
      
      if (randomSeed) {
        console.log(`✅ Random seed found and synced: ${randomSeed.toString()}`)
        
        // Generate mappings
        const maxSupply = await this.blockchainService.getMaxSupply()
        await this.mappingService.generateAllMappings(randomSeed, maxSupply)
        
        console.log('✅ Mappings generated successfully')
        
        // Stop monitoring since we found and processed the seed
        this.stopRandomSeedMonitoring()
        
        // Emit success event (could be used for notifications)
        this.onRandomSeedSynced(randomSeed)
      } else {
        console.log('⏳ Random seed not yet available, will check again...')
      }
      
    } catch (error) {
      console.error('❌ Error checking random seed:', error)
      // Continue monitoring even if there's an error
    }
  }

  /**
   * Callback for when random seed is successfully synced
   * Can be overridden or extended for custom behavior
   */
  private onRandomSeedSynced(randomSeed: bigint): void {
    console.log(`🎉 Random seed monitoring completed successfully: ${randomSeed.toString()}`)
    // You can add additional logic here like:
    // - Send notifications
    // - Update external systems
    // - Trigger other processes
  }

  /**
   * Force a manual check (useful for admin endpoints)
   */
  async forceCheck(): Promise<{ success: boolean; randomSeed?: string; message: string }> {
    try {
      // Check if blockchain service is configured
      if (!this.blockchainService.isServiceConfigured()) {
        return {
          success: false,
          message: 'Blockchain service not configured. Please check CONTRACT_ADDRESS and RPC_URL environment variables.'
        }
      }

      const randomSeed = await this.blockchainService.syncRandomSeedFromContract()
      
      if (randomSeed) {
        const maxSupply = await this.blockchainService.getMaxSupply()
        await this.mappingService.generateAllMappings(randomSeed, maxSupply)
        
        return {
          success: true,
          randomSeed: randomSeed.toString(),
          message: 'Random seed found and mappings generated'
        }
      } else {
        return {
          success: false,
          message: 'Random seed not yet available on blockchain'
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Error during manual check: ${error}`
      }
    }
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService(
  parseInt(process.env.RANDOM_SEED_CHECK_INTERVAL || '30000') // 30 seconds default
)
