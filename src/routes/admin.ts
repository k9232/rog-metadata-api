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
 * @swagger
 * /admin/random-seed-status:
 *   get:
 *     tags: [Admin]
 *     summary: Get random seed status
 *     responses:
 *       200:
 *         description: Success
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
 *     responses:
 *       200:
 *         description: Success
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
 * @swagger
 * /admin/blind-box-metadata:
 *   post:
 *     tags: [Admin]
 *     summary: Create blind box metadata
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               boxTypeId:
 *                 type: integer
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Success
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
 *     responses:
 *       200:
 *         description: Success
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
 * @swagger
 * /admin/detailed-stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get detailed system statistics
 *     responses:
 *       200:
 *         description: Success
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
