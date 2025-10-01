/**
 * Metadata API Routes
 * 
 * This module defines RESTful API endpoints for managing NFT metadata,
 * token information, and Phase 2 holder verification.
 */

import { Router } from 'express'
import { MetadataService } from '../services/metadata'
import { MappingService } from '../services/mapping'
import { getAddress, isAddress } from 'viem'
import { MINT_CONFIG } from '../config/contracts'
import { BlockchainService } from '../services/blockchain'

const router = Router()
const metadataService = new MetadataService()
const mappingService = new MappingService()
const blockchainService = new BlockchainService()

/**
 * @swagger
 * /metadata/{tokenId}:
 *   get:
 *     tags: [Metadata]
 *     summary: Get NFT metadata
 *     description: Retrieve metadata for a specific NFT token following the ERC-721 metadata standard
 *     parameters:
 *       - name: tokenId
 *         in: path
 *         required: true
 *         description: The token ID of the NFT
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenMetadata'
 *       400:
 *         description: Invalid token ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Token not found
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
 *     description: Create NFT information mapping for a specific token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokenId
 *               - userAddress
 *               - boxTypeId
 *             properties:
 *               tokenId:
 *                 type: integer
 *                 description: The token ID of the NFT
 *                 example: 1
 *               userAddress:
 *                 type: string
 *                 description: Ethereum wallet address of the user
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
 *               boxTypeId:
 *                 type: integer
 *                 description: Box type identifier (0=金盒, 1=紅盒, 2=藍盒, 3=公售盒)
 *                 minimum: 0
 *                 maximum: 3
 *                 example: 1
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *     description: Retrieve comprehensive statistics about the NFT collection
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
 *                     totalTokens:
 *                       type: integer
 *                       description: Total number of tokens in the collection
 *                       example: 6020
 *                     mintedTokens:
 *                       type: integer
 *                       description: Number of tokens that have been minted
 *                       example: 1500
 *                     revealedTokens:
 *                       type: integer
 *                       description: Number of tokens that have been revealed
 *                       example: 1200
 *                     boxTypeStats:
 *                       type: object
 *                       description: Statistics by box type
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         "0": 300
 *                         "1": 400
 *                         "2": 350
 *                         "3": 450
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * components:
 *   schemas:
 *     MintConfig:
 *       type: object
 *       properties:
 *         chainId:
 *           type: integer
 *           example: 11155111
 *         nftAddress:
 *           type: string
 *           example: "0x7c8614E7F475A95FB9362e8709B7623B556E0603"
 *         soulboundStartTime:
 *           type: string
 *           format: date-time
 *           example: "2025-08-25T06:00:00.000Z"
 *         soulboundEndTime:
 *           type: string
 *           format: date-time
 *           example: "2025-08-25T08:00:00.000Z"
 *         publicStartTime:
 *           type: string
 *           format: date-time
 *           example: "2025-08-25T10:00:00.000Z"
 *         mintPrice:
 *           type: string
 *           example: "0"
 * 
 * /api/mint/config:
 *   get:
 *     tags: [Mint]
 *     summary: Get mint configuration
 *     description: Retrieve the current mint configuration including timing and contract details
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
 *                   $ref: '#/components/schemas/MintConfig'
 *       500:
 *         description: Internal server error
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
 * /api/mint/soulbound/{address}:
 *   get:
 *     tags: [Mint]
 *     summary: Get Phase2 holder mint information
 *     description: Retrieve mint information for a specific Phase2 holder address
 *     parameters:
 *       - name: address
 *         in: path
 *         required: true
 *         description: Ethereum wallet address
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *           example: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
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
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     tokenId:
 *                       type: integer
 *                       example: 1
 *                     userAddress:
 *                       type: string
 *                       example: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
 *                     signature:
 *                       type: string
 *                       nullable: true
 *                       example: "0x..."
 *                     boxTypeId:
 *                       type: integer
 *                       example: 1
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       404:
 *         description: Phase2 holder not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "No signatures found for this Phase2 holder"
 *       500:
 *         description: Internal server error
 */
router.get('/api/mint/soulbound/:address', async (req, res) => {
  try {
    const { address: _address } = req.params
    if (!isAddress(_address, { strict: false })) {
      res.status(400).json({ error: 'Invalid address' })
      return
    }
    const address = getAddress(_address);
    
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
      data: {
        ...mintInfo,
        tokenId: mintInfo.id
      },
    })
  } catch (error) {
    console.error('Error getting Phase2 holder signatures:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/nft:
 *   get:
 *     tags: [NFT]
 *     summary: Get NFT collection information
 *     description: Retrieve current NFT collection statistics including minted count and total supply
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
 *                     totalSupply:
 *                       type: integer
 *                       description: Current number of minted NFTs
 *                       example: 1500
 *                     maxSupply:
 *                       type: integer
 *                       description: Maximum supply
 *                       example: 6020
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/api/nft', async (req, res) => {
  try {
    const totalSupply = await blockchainService.getTotalSupply()
    res.json({ success: true, data: {
      totalSupply: totalSupply,
      maxSupply: 6020,
    } })
  } catch (error) {
    console.error('Error getting max supply:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router;
