/**
 * Metadata API Routes
 * 
 * This module defines RESTful API endpoints for managing NFT metadata,
 * token information, and Phase 2 holder verification.
 */

import { Router } from 'express'
import { MetadataService } from '../services/metadata'
import { MappingService } from '../services/mapping'
import { getAddress } from 'ethers'

const router = Router()
const metadataService = new MetadataService()
const mappingService = new MappingService()

/**
 * @swagger
 * /metadata/{tokenId}:
 *   get:
 *     tags: [Metadata]
 *     summary: Get NFT metadata
 *     parameters:
 *       - name: tokenId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/metadata/:tokenId', async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId)
    
    if (isNaN(tokenId) || tokenId < 1) {
      return res.status(400).json({ error: 'Invalid token ID' })
    }

    const metadata = await metadataService.getTokenMetadata(tokenId)
    
    if (!metadata) {
      return res.status(404).json({ error: 'Token not found' })
    }

    res.json(metadata)
  } catch (error) {
    console.error(`Error getting metadata for token ${req.params.tokenId}:`, error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/nft:
 *   post:
 *     tags: [NFT]
 *     summary: Create NFT info
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tokenId:
 *                 type: integer
 *               userAddress:
 *                 type: string
 *               boxTypeId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/api/nft', async (req, res) => {
  try {
    const { tokenId, userAddress, boxTypeId } = req.body
    
    if (!tokenId || !userAddress || boxTypeId === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    await mappingService.createNftInfo({
      tokenId: parseInt(tokenId),
      userAddress,
      boxTypeId: parseInt(boxTypeId)
    })

    res.json({ success: true, message: 'NFT info created' })
  } catch (error) {
    console.error('Error creating NFT info:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/stats:
 *   get:
 *     tags: [Stats]
 *     summary: Get collection statistics
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/api/stats', async (req, res) => {
  try {
    const stats = await metadataService.getStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error('Error getting stats:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})


export const MINT_CONFIG = {
  soulboundStartTime: new Date(Math.floor(new Date('2025-08-25 06:00:00').getTime() / 1000) * 1000).toISOString(),
  soulboundEndTime: new Date((Math.floor(new Date('2025-08-25 06:00:00').getTime() / 1000) + (60 * 60 * 2)) * 1000).toISOString(),
  publicStartTime: new Date((Math.floor(new Date('2025-08-25 06:00:00').getTime() / 1000) + (60 * 60 * 4)) * 1000).toISOString(),
  mintPrice: "0"
}


/**
 * @swagger
 * /api/mint/config:
 *   get:
 *     tags: [Mint]
 *     summary: Get mint configuration
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/api/mint/config', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      data: MINT_CONFIG
    })
  } catch (error) {
    console.error('Error getting mint config:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/mint/{address}:
 *   get:
 *     tags: [Mint]
 *     summary: Get Phase2 holder status and box types
 *     parameters:
 *       - name: address
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/api/mint/:address', async (req, res) => {
  try {
    const { address: _address } = req.params
    const address = getAddress(_address)
    
    const holderInfo = await metadataService.getPhase2HolderInfo(address)
    
    res.json({ 
      success: true, 
      data: holderInfo
    })
  } catch (error) {
    console.error('Error checking Phase2 holder:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/mint/{address}/signature:
 *   get:
 *     tags: [Mint]
 *     summary: Get Phase2 signature
 *     parameters:
 *       - name: address
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/api/mint/:address/signature', async (req, res) => {
  try {
    const { address: _address } = req.params
    const address = getAddress(_address)
    
    // Get all signatures for this holder
    const mintInfo = await metadataService.getPhase2HolderMintInfo(address)
    
    if (!mintInfo) {
      return res.status(404).json({ 
        success: false, 
        error: 'No signatures found for this Phase2 holder' 
      })
    }
    
    res.json({ 
      success: true, 
      data: mintInfo,
    })
  } catch (error) {
    console.error('Error getting Phase2 holder signatures:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})





export default router
