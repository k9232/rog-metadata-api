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
import { schedulerService } from '../services/scheduler'
import { nftSyncService } from '../services/nft-sync'
import { adminAuth, adminRateLimit } from '../middleware/auth'
import prisma from '../config/database'

const router = Router()
const metadataService = new MetadataService()
const blockchainService = new BlockchainService()
const mappingService = new MappingService()

// Apply authentication and rate limiting to all admin routes
router.use(adminRateLimit)
router.use(adminAuth)

/**
 * @swagger
 * /admin/random-seed-status:
 *   get:
 *     tags: [Admin]
 *     summary: Get random seed status
 *     description: Retrieve the current random seed status from the blockchain contract and database
 *     security:
 *       - AdminApiKey: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     randomSeed:
 *                       type: string
 *                       example: "12345678901234567890"
 *                     isRevealed:
 *                       type: boolean
 *                       example: true
 *                     mappingsGenerated:
 *                       type: boolean
 *                       example: true
 *                     syncedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Unauthorized - Admin API key required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Invalid admin API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /admin/sync-randomseed:
 *   post:
 *     tags: [Admin]
 *     summary: Sync random seed from blockchain
 *     description: Manually sync the random seed from the blockchain contract and generate mappings
 *     security:
 *       - AdminApiKey: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Random seed sync completed"
 *                 randomSeed:
 *                   type: string
 *                   nullable: true
 *                   example: "12345678901234567890"
 *       401:
 *         description: Unauthorized - Admin API key required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/admin/sync-randomseed', async (req, res) => {
  try {
    const {
      randomSeed,
      needToGenerateMappings,
    } = await blockchainService.syncRandomSeedFromContract()
    
    if (randomSeed) {
      const maxSupply = await blockchainService.getMaxSupply()
      await mappingService.generateAllMappings(randomSeed, maxSupply)
    }
    
    res.json({
      success: true,
      message: 'Random seed sync completed',
      randomSeed: randomSeed?.toString() || null,
      needToGenerateMappings,
    })
  } catch (error) {
    console.error('Error syncing random seed:', error)
    res.status(500).json({ success: false, error: 'Failed to sync random seed' })
  }
})

/**
 * @swagger
 * /admin/blind-box-metadata:
 *   post:
 *     tags: [Admin]
 *     summary: Create blind box metadata
 *     description: Create metadata template for a specific blind box type
 *     security:
 *       - AdminApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - boxTypeId
 *               - metadata
 *             properties:
 *               boxTypeId:
 *                 type: integer
 *                 description: Box type identifier (0=金盒, 1=紅盒, 2=藍盒, 3=公售盒)
 *                 minimum: 0
 *                 maximum: 3
 *                 example: 1
 *               metadata:
 *                 $ref: '#/components/schemas/TokenMetadata'
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /admin/origin-metadata:
 *   post:
 *     tags: [Admin]
 *     summary: Create origin metadata
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               originId:
 *                 type: integer
 *               boxTypeId:
 *                 type: integer
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Success
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
 * @swagger
 * /admin/batch-origin-metadata:
 *   post:
 *     tags: [Admin]
 *     summary: Create batch origin metadata
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               boxTypeId:
 *                 type: integer
 *               metadataList:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Success
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
 * @swagger
 * /admin/phase2-holder:
 *   post:
 *     tags: [Admin]
 *     summary: Add Phase2 holder
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userAddress:
 *                 type: string
 *               boxTypeId:
 *                 type: integer
 *               tokenId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/admin/phase2-holder', async (req, res) => {
  try {
    const { userAddress, boxTypeId, tokenId } = req.body
    
    if (!userAddress || boxTypeId === undefined || tokenId === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'userAddress, boxTypeId and tokenId are required' 
      })
    }

    await metadataService.addPhase2Holder(userAddress, parseInt(boxTypeId), parseInt(tokenId))
    
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
 * @swagger
 * /admin/batch-phase2-holders:
 *   post:
 *     tags: [Admin]
 *     summary: Add batch Phase2 holders
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               holders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userAddress:
 *                       type: string
 *                     boxTypeId:
 *                       type: integer
 *                     tokenId:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Success
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
      if (holder.userAddress && holder.boxTypeId !== undefined && holder.tokenId !== undefined) {
        await metadataService.addPhase2Holder(holder.userAddress, parseInt(holder.boxTypeId), parseInt(holder.tokenId))
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
 * @swagger
 * /admin/detailed-stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get detailed system statistics
 *     description: Retrieve comprehensive system statistics including database info
 *     security:
 *       - AdminApiKey: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: Detailed statistics object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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

/**
 * @swagger
 * /admin/scheduler/status:
 *   get:
 *     tags: [Admin]
 *     summary: Get scheduler status
 *     description: Get the current status of the random seed monitoring scheduler
 *     security:
 *       - AdminApiKey: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     isRunning:
 *                       type: boolean
 *                       example: true
 *                     interval:
 *                       type: integer
 *                       example: 30000
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/admin/scheduler/status', (req, res) => {
  try {
    const status = schedulerService.getStatus()
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    console.error('Error getting scheduler status:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// /**
//  * @swagger
//  * /admin/scheduler/start:
//  *   post:
//  *     tags: [Admin]
//  *     summary: Start random seed monitoring
//  *     responses:
//  *       200:
//  *         description: Success
//  */
// router.post('/admin/scheduler/start', async (req, res) => {
//   try {
//     await schedulerService.startRandomSeedMonitoring()
//     res.json({
//       success: true,
//       message: 'Random seed monitoring started'
//     })
//   } catch (error) {
//     console.error('Error starting scheduler:', error)
//     res.status(500).json({ success: false, error: 'Failed to start monitoring' })
//   }
// })

/**
 * @swagger
 * /admin/scheduler/stop:
 *   post:
 *     tags: [Admin]
 *     summary: Stop random seed monitoring
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/admin/scheduler/stop', (req, res) => {
  try {
    schedulerService.stopRandomSeedMonitoring()
    res.json({
      success: true,
      message: 'Random seed monitoring stopped'
    })
  } catch (error) {
    console.error('Error stopping scheduler:', error)
    res.status(500).json({ success: false, error: 'Failed to stop monitoring' })
  }
})

/**
 * @swagger
 * /admin/scheduler/force-check:
 *   post:
 *     tags: [Admin]
 *     summary: Force manual random seed check
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/admin/scheduler/force-check', async (req, res) => {
  try {
    const result = await schedulerService.forceCheck()
    res.json({
      success: result.success,
      message: result.message,
      randomSeed: result.randomSeed
    })
  } catch (error) {
    console.error('Error during force check:', error)
    res.status(500).json({ success: false, error: 'Failed to perform force check' })
  }
})

// NFT Sync Management Endpoints

/**
 * @swagger
 * /admin/nft-sync/status:
 *   get:
 *     tags: [Admin]
 *     summary: Get NFT sync status
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/admin/nft-sync/status', async (req, res) => {
  try {
    const syncStatus = await nftSyncService.getSyncStatus()
    const schedulerStatus = schedulerService.getStatus()
    
    res.json({
      success: true,
      data: {
        ...syncStatus,
        schedulerRunning: schedulerStatus.isNftSyncRunning,
        syncInterval: schedulerStatus.nftSyncInterval
      }
    })
  } catch (error) {
    console.error('Error getting NFT sync status:', error)
    res.status(500).json({ success: false, error: 'Failed to get sync status' })
  }
})

/**
 * @swagger
 * /admin/nft-sync/start:
 *   post:
 *     tags: [Admin]
 *     summary: Start NFT sync monitoring
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/admin/nft-sync/start', async (req, res) => {
  try {
    await schedulerService.startNftSyncMonitoring()
    res.json({
      success: true,
      message: 'NFT sync monitoring started'
    })
  } catch (error) {
    console.error('Error starting NFT sync:', error)
    res.status(500).json({ success: false, error: 'Failed to start NFT sync monitoring' })
  }
})

/**
 * @swagger
 * /admin/nft-sync/stop:
 *   post:
 *     tags: [Admin]
 *     summary: Stop NFT sync monitoring
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/admin/nft-sync/stop', (req, res) => {
  try {
    schedulerService.stopNftSyncMonitoring()
    res.json({
      success: true,
      message: 'NFT sync monitoring stopped'
    })
  } catch (error) {
    console.error('Error stopping NFT sync:', error)
    res.status(500).json({ success: false, error: 'Failed to stop NFT sync monitoring' })
  }
})

/**
 * @swagger
 * /admin/nft-sync/force-sync:
 *   post:
 *     tags: [Admin]
 *     summary: Force manual NFT sync
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromBlock:
 *                 type: integer
 *                 description: Starting block number (optional)
 *               toBlock:
 *                 type: integer
 *                 description: Ending block number (optional)
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/admin/nft-sync/force-sync', async (req, res) => {
  try {
    const { fromBlock, toBlock } = req.body
    const result = await schedulerService.forceNftSync(fromBlock, toBlock)
    
    res.json({
      success: result.success,
      message: result.message,
      result: result.result
    })
  } catch (error) {
    console.error('Error during force NFT sync:', error)
    res.status(500).json({ success: false, error: 'Failed to perform force NFT sync' })
  }
})

/**
 * @swagger
 * /admin/nft-sync/historical:
 *   post:
 *     tags: [Admin]
 *     summary: Sync historical Transfer events
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromBlock:
 *                 type: integer
 *                 description: Starting block number
 *               toBlock:
 *                 type: integer
 *                 description: Ending block number (optional, defaults to latest)
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/admin/nft-sync/historical', async (req, res) => {
  try {
    const { fromBlock, toBlock } = req.body
    
    if (!fromBlock) {
      return res.status(400).json({ 
        success: false, 
        error: 'fromBlock is required' 
      })
    }

    const result = await nftSyncService.syncHistoricalEvents(fromBlock, toBlock)
    
    res.json({
      success: true,
      message: 'Historical sync completed',
      result
    })
  } catch (error) {
    console.error('Error during historical NFT sync:', error)
    res.status(500).json({ success: false, error: 'Failed to perform historical sync' })
  }
})

export default router
