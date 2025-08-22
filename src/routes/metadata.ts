/**
 * Metadata API Routes
 * 
 * This module defines RESTful API endpoints for managing NFT metadata,
 * token information, and Phase 2 holder verification.
 */

import { Router } from 'express'
import { MetadataService } from '../services/metadata'
import { MappingService } from '../services/mapping'

const router = Router()
const metadataService = new MetadataService()
const mappingService = new MappingService()

/**
 * GET /metadata/:tokenId
 * 
 * Retrieves metadata for a specific NFT token by its ID.
 * This endpoint follows the ERC-721 metadata standard.
 * 
 * @param tokenId - The unique identifier of the NFT token (must be a positive integer)
 * @returns JSON object containing the token's metadata or error message
 * 
 * @example
 * GET /metadata/123
 * Response: { "name": "Token #123", "image": "...", "attributes": [...] }
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
 * POST /api/nft
 * 
 * Creates a new NFT information record in the system.
 * This endpoint is typically called when a new NFT is minted or when
 * associating an NFT with specific user and box type information.
 * 
 * @body tokenId - The unique identifier of the NFT token
 * @body userAddress - The wallet address of the token owner
 * @body boxTypeId - The type identifier for the NFT box/category
 * @returns Success confirmation or error message
 * 
 * @example
 * POST /api/nft
 * Body: { "tokenId": 123, "userAddress": "0x123...", "boxTypeId": 1 }
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
 * GET /api/stats
 * 
 * Retrieves statistical information about the NFT collection.
 * This endpoint provides aggregate data such as total supply,
 * distribution by box types, and other collection metrics.
 * 
 * @returns JSON object containing collection statistics
 * 
 * @example
 * GET /api/stats
 * Response: { "success": true, "data": { "totalSupply": 1000, "byBoxType": {...} } }
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
 * GET /api/phase2/:address/:boxTypeId
 * 
 * Verifies if a given wallet address is a Phase 2 holder for a specific box type.
 * This endpoint is used for access control and privilege verification in the system.
 * 
 * @param address - The wallet address to check (Ethereum address format)
 * @param boxTypeId - The box type identifier to verify against
 * @returns JSON object indicating Phase 2 holder status with address and box type info
 * 
 * @example
 * GET /api/phase2/0x123.../1
 * Response: { "success": true, "data": { "isPhase2Holder": true, "address": "0x123...", "boxTypeId": 1 } }
 */
router.get('/api/phase2/:address/:boxTypeId', async (req, res) => {
  try {
    const { address, boxTypeId } = req.params
    
    const isHolder = await metadataService.isPhase2Holder(address, parseInt(boxTypeId))
    
    res.json({ 
      success: true, 
      data: { 
        isPhase2Holder: isHolder,
        address,
        boxTypeId: parseInt(boxTypeId)
      }
    })
  } catch (error) {
    console.error('Error checking Phase2 holder:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
