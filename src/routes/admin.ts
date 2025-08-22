/**
 * Admin API Routes
 * 
 * This module defines administrative endpoints for managing NFT metadata,
 * blockchain synchronization, Phase 2 holders, and system statistics.
 * These endpoints require administrative privileges.
 */

import { Router } from 'express'
import { MetadataService } from '../services/metadata'
import { BlockchainService } from '../services/blockchain'
import { MappingService } from '../services/mapping'
import { TokenMetadata } from '../services/metadata'
import prisma from '../config/database'

const router = Router()
const metadataService = new MetadataService()
const blockchainService = new BlockchainService()
const mappingService = new MappingService()

/**
 * GET /admin/random-seed-status
 * 
 * Retrieves the current status of the random seed from both the blockchain
 * contract and the local database. Used to monitor synchronization status.
 * 
 * @returns JSON object containing random seed, reveal status, and mapping generation info
 * 
 * @example
 * GET /admin/random-seed-status
 * Response: { "success": true, "data": { "randomSeed": "123...", "isRevealed": true, "mappingsGenerated": true } }
 */
router.get('/admin/random-seed-status', async (req, res) => {
  try {
    const contractStatus = await blockchainService.getRandomSeedStatus()
    
    const dbSeed = await prisma.randomSeedInfo.findFirst({
      where: { randomSeed: contractStatus.randomSeed.toString() },
      orderBy: { syncedAt: 'desc' }
    })

    res.json({
      success: true,
      data: {
        randomSeed: contractStatus.randomSeed.toString(),
        isRevealed: contractStatus.isRevealed,
        mappingsGenerated: dbSeed?.mappingsGenerated || false,
        syncedAt: dbSeed?.syncedAt?.toISOString()
      }
    })
  } catch (error) {
    console.error('Error getting random seed status:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /admin/sync-randomseed
 * 
 * Synchronizes the random seed from the blockchain contract to the local database
 * and generates all token mappings based on the seed and max supply.
 * 
 * @returns JSON object confirming sync completion and the synced random seed
 * 
 * @example
 * POST /admin/sync-randomseed
 * Response: { "success": true, "message": "Random seed sync completed", "randomSeed": "123..." }
 */
router.post('/admin/sync-randomseed', async (req, res) => {
  try {
    const randomSeed = await blockchainService.syncRandomSeedFromContract()
    
    if (randomSeed) {
      const maxSupply = await blockchainService.getMaxSupply()
      await mappingService.generateAllMappings(randomSeed, maxSupply)
    }
    
    res.json({
      success: true,
      message: 'Random seed sync completed',
      randomSeed: randomSeed?.toString() || null
    })
  } catch (error) {
    console.error('Error syncing random seed:', error)
    res.status(500).json({ success: false, error: 'Failed to sync random seed' })
  }
})

/**
 * POST /admin/blind-box-metadata
 * 
 * Creates metadata for blind box NFTs before they are revealed.
 * This metadata is shown to users before the random seed is revealed.
 * 
 * @body boxTypeId - The box type identifier for the blind box
 * @body metadata - The metadata object containing name, image, description, etc.
 * @returns Success confirmation message
 * 
 * @example
 * POST /admin/blind-box-metadata
 * Body: { "boxTypeId": 1, "metadata": { "name": "Mystery Box", "image": "..." } }
 */
router.post('/admin/blind-box-metadata', async (req, res) => {
  try {
    const { boxTypeId, metadata } = req.body
    
    if (boxTypeId === undefined || !metadata) {
      return res.status(400).json({ success: false, error: 'boxTypeId and metadata are required' })
    }

    await metadataService.createBlindBoxMetadata(parseInt(boxTypeId), metadata as TokenMetadata)
    
    res.json({
      success: true,
      message: `Created blind box metadata for boxType ${boxTypeId}`
    })
  } catch (error) {
    console.error('Error creating blind box metadata:', error)
    res.status(500).json({ success: false, error: 'Failed to create blind box metadata' })
  }
})

/**
 * POST /admin/origin-metadata
 * 
 * Creates metadata for a specific origin NFT after reveal.
 * Each origin represents a unique NFT with its own metadata.
 * 
 * @body originId - The unique origin identifier for the NFT
 * @body boxTypeId - The box type this origin belongs to
 * @body metadata - The complete metadata object for this specific NFT
 * @returns Success confirmation message
 * 
 * @example
 * POST /admin/origin-metadata
 * Body: { "originId": 1, "boxTypeId": 1, "metadata": { "name": "Dragon #1", "image": "..." } }
 */
router.post('/admin/origin-metadata', async (req, res) => {
  try {
    const { originId, boxTypeId, metadata } = req.body
    
    if (!originId || boxTypeId === undefined || !metadata) {
      return res.status(400).json({ 
        success: false, 
        error: 'originId, boxTypeId and metadata are required' 
      })
    }

    await metadataService.createOriginMetadata(
      parseInt(originId), 
      parseInt(boxTypeId), 
      metadata as TokenMetadata
    )
    
    res.json({
      success: true,
      message: `Created origin metadata for originId ${originId}`
    })
  } catch (error) {
    console.error('Error creating origin metadata:', error)
    res.status(500).json({ success: false, error: 'Failed to create origin metadata' })
  }
})

/**
 * POST /admin/batch-origin-metadata
 * 
 * Creates multiple origin metadata entries in a single batch operation.
 * Efficient for uploading large collections of NFT metadata.
 * 
 * @body boxTypeId - The box type all origins belong to
 * @body metadataList - Array of objects containing originId and metadata pairs
 * @returns Success message with count of created entries
 * 
 * @example
 * POST /admin/batch-origin-metadata
 * Body: { "boxTypeId": 1, "metadataList": [{ "originId": 1, "metadata": {...} }, ...] }
 */
router.post('/admin/batch-origin-metadata', async (req, res) => {
  try {
    const { boxTypeId, metadataList } = req.body
    
    if (boxTypeId === undefined || !Array.isArray(metadataList)) {
      return res.status(400).json({ 
        success: false, 
        error: 'boxTypeId and metadataList array are required' 
      })
    }

    let created = 0
    for (const item of metadataList) {
      if (item.originId && item.metadata) {
        await metadataService.createOriginMetadata(
          parseInt(item.originId),
          parseInt(boxTypeId),
          item.metadata as TokenMetadata
        )
        created++
      }
    }
    
    res.json({
      success: true,
      message: `Created ${created} origin metadata entries for boxType ${boxTypeId}`
    })
  } catch (error) {
    console.error('Error creating batch origin metadata:', error)
    res.status(500).json({ success: false, error: 'Failed to create batch origin metadata' })
  }
})

/**
 * POST /admin/phase2-holder
 * 
 * Adds a wallet address as a Phase 2 holder for a specific box type.
 * Phase 2 holders have special privileges or access rights in the system.
 * 
 * @body userAddress - The wallet address to grant Phase 2 status
 * @body boxTypeId - The box type for which to grant Phase 2 status
 * @returns Success confirmation with added holder information
 * 
 * @example
 * POST /admin/phase2-holder
 * Body: { "userAddress": "0x123...", "boxTypeId": 1 }
 */
router.post('/admin/phase2-holder', async (req, res) => {
  try {
    const { userAddress, boxTypeId } = req.body
    
    if (!userAddress || boxTypeId === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'userAddress and boxTypeId are required' 
      })
    }

    await metadataService.addPhase2Holder(userAddress, parseInt(boxTypeId))
    
    res.json({
      success: true,
      message: `Added Phase2 holder: ${userAddress} for boxType ${boxTypeId}`
    })
  } catch (error) {
    console.error('Error adding Phase2 holder:', error)
    res.status(500).json({ success: false, error: 'Failed to add Phase2 holder' })
  }
})

/**
 * POST /admin/batch-phase2-holders
 * 
 * Adds multiple wallet addresses as Phase 2 holders in a single batch operation.
 * Efficient for granting Phase 2 status to large groups of users.
 * 
 * @body holders - Array of objects containing userAddress and boxTypeId pairs
 * @returns Success message with count of added holders
 * 
 * @example
 * POST /admin/batch-phase2-holders
 * Body: { "holders": [{ "userAddress": "0x123...", "boxTypeId": 1 }, ...] }
 */
router.post('/admin/batch-phase2-holders', async (req, res) => {
  try {
    const { holders } = req.body
    
    if (!Array.isArray(holders)) {
      return res.status(400).json({ 
        success: false, 
        error: 'holders array is required' 
      })
    }

    let added = 0
    for (const holder of holders) {
      if (holder.userAddress && holder.boxTypeId !== undefined) {
        await metadataService.addPhase2Holder(holder.userAddress, parseInt(holder.boxTypeId))
        added++
      }
    }
    
    res.json({
      success: true,
      message: `Added ${added} Phase2 holders`
    })
  } catch (error) {
    console.error('Error adding batch Phase2 holders:', error)
    res.status(500).json({ success: false, error: 'Failed to add batch Phase2 holders' })
  }
})

/**
 * GET /admin/detailed-stats
 * 
 * Retrieves comprehensive statistics about the entire NFT system including
 * collection stats, random seed information, and Phase 2 holder counts.
 * 
 * @returns JSON object containing detailed system statistics
 * 
 * @example
 * GET /admin/detailed-stats
 * Response: { "success": true, "data": { "totalSupply": 1000, "randomSeedInfo": [...], "phase2HoldersCount": [...] } }
 */
router.get('/admin/detailed-stats', async (req, res) => {
  try {
    const stats = await metadataService.getStats()
    
    const randomSeedInfo = await prisma.randomSeedInfo.findMany({
      orderBy: { syncedAt: 'desc' }
    })
    
    const phase2HoldersCount = await prisma.phase2Holders.groupBy({
      by: ['boxTypeId'],
      _count: { id: true }
    })
    
    res.json({
      success: true,
      data: {
        ...stats,
        randomSeedInfo,
        phase2HoldersCount
      }
    })
  } catch (error) {
    console.error('Error getting detailed stats:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
