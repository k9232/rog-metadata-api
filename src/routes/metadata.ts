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

/**
 * @swagger
 * /api/phase2/{address}:
 *   get:
 *     tags: [Phase2]
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
router.get('/api/phase2/:address', async (req, res) => {
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
 * /api/phase2/{address}/{boxTypeId}/signature:
 *   get:
 *     tags: [Phase2]
 *     summary: Get Phase2 signature
 *     parameters:
 *       - name: address
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: boxTypeId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *   post:
 *     tags: [Phase2]
 *     summary: Generate Phase2 signature
 *     parameters:
 *       - name: address
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: boxTypeId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tokenId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/api/phase2/:address/:boxTypeId/signature', async (req, res) => {
  try {
    const { address, boxTypeId } = req.params
    
    // First verify that the address is a Phase2 holder
    const isHolder = await metadataService.isPhase2Holder(address, parseInt(boxTypeId))
    
    if (!isHolder) {
      return res.status(404).json({ 
        success: false, 
        error: 'Address is not a Phase2 holder for this box type' 
      })
    }
    
    // Get the signature for this holder
    const signature = await metadataService.getPhase2HolderSignature(address, parseInt(boxTypeId))
    
    if (!signature) {
      return res.status(404).json({ 
        success: false, 
        error: 'Signature not found for this Phase2 holder' 
      })
    }
    
    res.json({ 
      success: true, 
      data: { 
        signature,
        address,
        boxTypeId: parseInt(boxTypeId)
      }
    })
  } catch (error) {
    console.error('Error getting Phase2 holder signature:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/api/phase2/:address/:boxTypeId/signature', async (req, res) => {
  try {
    const { address, boxTypeId } = req.params
    const { tokenId } = req.body
    
    if (!tokenId) {
      return res.status(400).json({ 
        success: false, 
        error: 'tokenId is required' 
      })
    }
    
    // Verify that the address is a Phase2 holder
    const isHolder = await metadataService.isPhase2Holder(address, parseInt(boxTypeId))
    
    if (!isHolder) {
      return res.status(404).json({ 
        success: false, 
        error: 'Address is not a Phase2 holder for this box type' 
      })
    }
    
    // Get the signer private key from environment variables
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY
    if (!signerPrivateKey) {
      console.error('SIGNER_PRIVATE_KEY environment variable not set')
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      })
    }
    
    // Generate and store the signature
    const signature = await metadataService.generateAndStorePhase2Signature(
      address,
      parseInt(tokenId),
      parseInt(boxTypeId),
      signerPrivateKey
    )
    
    res.json({ 
      success: true, 
      data: { 
        signature,
        tokenId: parseInt(tokenId),
        address,
        boxTypeId: parseInt(boxTypeId)
      }
    })
  } catch (error) {
    console.error('Error generating Phase2 holder signature:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
