/**
 * NFT Sync Service for Transfer Event Monitoring
 * 
 * This service monitors Transfer events from the ERC721 contract
 * and updates the NftInfo table when mint events are detected.
 */

import { BlockchainService } from './blockchain'
import prisma from '../config/database'
import { zeroAddress } from 'viem'

const ZERO_ADDRESS = zeroAddress;

export class NftSyncService {
  private blockchainService: BlockchainService
  private isListening = false
  private lastProcessedBlock = 0

  constructor() {
    this.blockchainService = new BlockchainService()
  }

  /**
   * Start listening for Transfer events
   */
  async startTransferMonitoring(): Promise<void> {
    if (this.isListening) {
      console.log('Transfer monitoring is already running')
      return
    }

    if (!this.blockchainService.isServiceConfigured()) {
      console.warn('⚠️ Blockchain service not configured, Transfer monitoring disabled')
      return
    }

    console.log('🎯 Starting Transfer event monitoring...')
    this.isListening = true

    // Get the last processed block from database or start from current block
    await this.initializeLastProcessedBlock()

    // Start real-time event listener
    await this.blockchainService.startTransferEventListener(async (from, to, tokenId) => {
      await this.handleTransferEvent(from, to, tokenId)
    })

    console.log('✅ Transfer event monitoring started')
  }

  /**
   * Stop Transfer event monitoring
   */
  stopTransferMonitoring(): void {
    this.isListening = false
    console.log('Transfer monitoring stopped')
  }

  /**
   * Check if monitoring is currently running
   */
  isMonitoring(): boolean {
    return this.isListening
  }

  /**
   * Initialize the last processed block number
   */
  private async initializeLastProcessedBlock(): Promise<void> {
    try {
      // Try to get the last processed block from database
      const syncStatus = await prisma.syncStatus.findFirst({
        where: { syncType: 'transfer_events' },
        orderBy: { lastProcessedBlock: 'desc' }
      })

      if (syncStatus) {
        this.lastProcessedBlock = syncStatus.lastProcessedBlock
        console.log(`📍 Resuming from block: ${this.lastProcessedBlock}`)
      } else {
        // Start from current block if no previous sync status
        this.lastProcessedBlock = await this.blockchainService.getLatestBlockNumber()
        console.log(`📍 Starting from current block: ${this.lastProcessedBlock}`)
        
        // Create initial sync status record
        await prisma.syncStatus.create({
          data: {
            syncType: 'transfer_events',
            lastProcessedBlock: this.lastProcessedBlock,
            updatedAt: new Date()
          }
        })
      }
    } catch (error) {
      console.error('Error initializing last processed block:', error)
      // Fallback to current block
      this.lastProcessedBlock = await this.blockchainService.getLatestBlockNumber()
    }
  }

  /**
   * Handle Transfer event
   */
  private async handleTransferEvent(from: string, to: string, tokenId: bigint): Promise<void> {
    try {
      const tokenIdNum = Number(tokenId)
      console.log(`🔄 Processing Transfer: from=${from}, to=${to}, tokenId=${tokenIdNum}`)

      // Check if this is a mint event (from zero address)
      if (from.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
        await this.handleMintEvent(to, tokenIdNum)
      } else {
        // Handle regular transfer (update owner)
        await this.handleOwnershipTransfer(from, to, tokenIdNum)
      }

      // Update last processed block
      const currentBlock = await this.blockchainService.getLatestBlockNumber()
      await this.updateLastProcessedBlock(currentBlock)

    } catch (error) {
      console.error(`❌ Error handling Transfer event for tokenId ${tokenId}:`, error)
    }
  }

  /**
   * Handle mint event (from = zero address)
   */
  private async handleMintEvent(to: string, tokenId: number): Promise<void> {
    try {
      console.log(`🎉 Mint detected: tokenId=${tokenId}, to=${to}`)

      // Check if user is a Phase2 holder to determine boxTypeId
      const phase2Holder = await prisma.phase2Holders.findFirst({
        where: { userAddress: to }
      })

      const boxTypeId = phase2Holder ? phase2Holder.boxTypeId : 0
      
      if (phase2Holder) {
        console.log(`👑 Phase2 holder detected: ${to}, boxTypeId=${boxTypeId}`)
      } else {
        console.log(`👤 Regular user: ${to}, boxTypeId=${boxTypeId}`)
      }

      // Check if NFT already exists in database
      const existingNft = await prisma.nftInfo.findUnique({
        where: { tokenId }
      })

      if (existingNft) {
        console.log(`⚠️ NFT ${tokenId} already exists, updating owner address and boxTypeId`)
        // Update the owner address and boxTypeId if they're different
        if (existingNft.userAddress !== to || existingNft.boxTypeId !== boxTypeId) {
          await prisma.nftInfo.update({
            where: { tokenId },
            data: { 
              userAddress: to,
              boxTypeId: boxTypeId
            }
          })
          console.log(`✅ Updated NFT ${tokenId}: owner=${to}, boxTypeId=${boxTypeId}`)
        }
      } else {
        // Create new NFT record with appropriate boxTypeId
        await prisma.nftInfo.create({
          data: {
            tokenId,
            metadataId: null,
            userAddress: to,
            boxTypeId: boxTypeId,
            originId: 0,
            createdAt: new Date()
          }
        })
        console.log(`✅ Created new NFT record for tokenId ${tokenId}: owner=${to}, boxTypeId=${boxTypeId}`)
      }

    } catch (error) {
      console.error(`❌ Error handling mint event for tokenId ${tokenId}:`, error)
      throw error
    }
  }

  /**
   * Handle ownership transfer (regular transfer between addresses)
   */
  private async handleOwnershipTransfer(from: string, to: string, tokenId: number): Promise<void> {
    try {
      console.log(`🔄 Transfer detected: tokenId=${tokenId}, from=${from}, to=${to}`)

      // Update the owner address
      const result = await prisma.nftInfo.updateMany({
        where: { 
          tokenId,
          userAddress: from // Only update if current owner matches 'from' address
        },
        data: { userAddress: to }
      })

      if (result.count > 0) {
        console.log(`✅ Updated owner for tokenId ${tokenId}: ${from} → ${to}`)
      } else {
        console.log(`⚠️ No update needed for tokenId ${tokenId} (owner mismatch or not found)`)
      }

    } catch (error) {
      console.error(`❌ Error handling ownership transfer for tokenId ${tokenId}:`, error)
      throw error
    }
  }

  /**
   * Update the last processed block in database
   */
  private async updateLastProcessedBlock(blockNumber: number): Promise<void> {
    try {
      await prisma.syncStatus.upsert({
        where: { 
          syncType: 'transfer_events'
        },
        update: {
          lastProcessedBlock: blockNumber,
          updatedAt: new Date()
        },
        create: {
          syncType: 'transfer_events',
          lastProcessedBlock: blockNumber,
          updatedAt: new Date()
        }
      })
      this.lastProcessedBlock = blockNumber
    } catch (error) {
      console.error('Error updating last processed block:', error)
    }
  }

  /**
   * Sync historical Transfer events from a specific block range
   */
  async syncHistoricalEvents(fromBlock?: number, toBlock?: number): Promise<{
    processed: number;
    mints: number;
    transfers: number;
    errors: number;
  }> {
    if (!this.blockchainService.isServiceConfigured()) {
      throw new Error('Blockchain service not configured')
    }

    const startBlock = fromBlock || this.lastProcessedBlock
    const endBlock = toBlock || await this.blockchainService.getLatestBlockNumber()

    console.log(`🔍 Syncing historical Transfer events from block ${startBlock} to ${endBlock}`)

    let processed = 0
    let mints = 0
    let transfers = 0
    let errors = 0

    try {
      const events = await this.blockchainService.getTransferEvents(startBlock, endBlock)
      console.log(`📦 Found ${events.length} Transfer events`)

      for (const event of events) {
        try {
          const tokenIdNum = Number(event.tokenId)
          
          if (event.from.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
            await this.handleMintEvent(event.to, tokenIdNum)
            mints++
          } else {
            await this.handleOwnershipTransfer(event.from, event.to, tokenIdNum)
            transfers++
          }
          
          processed++
        } catch (error) {
          console.error(`Error processing event for tokenId ${event.tokenId}:`, error)
          errors++
        }
      }

      // Update last processed block
      await this.updateLastProcessedBlock(endBlock)

      console.log(`✅ Historical sync completed: ${processed} processed, ${mints} mints, ${transfers} transfers, ${errors} errors`)

    } catch (error) {
      console.error('Error syncing historical events:', error)
      throw error
    }

    return { processed, mints, transfers, errors }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    isListening: boolean;
    lastProcessedBlock: number;
    currentBlock: number;
    blocksBehind: number;
  }> {
    const currentBlock = this.blockchainService.isServiceConfigured() 
      ? await this.blockchainService.getLatestBlockNumber()
      : 0

    return {
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock,
      currentBlock,
      blocksBehind: Math.max(0, currentBlock - this.lastProcessedBlock)
    }
  }
}

// Export singleton instance
export const nftSyncService = new NftSyncService()
