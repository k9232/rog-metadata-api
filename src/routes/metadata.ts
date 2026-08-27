/**
 * Static metadata routes backed by the frozen OpenSea catalog.
 */

import { Router } from 'express'
import { MetadataService } from '../services/metadata'

const router = Router()
const metadataService = new MetadataService()

/**
 * @swagger
 * /metadata/nft-info/{tokenId}:
 *   get:
 *     tags: [Metadata]
 *     summary: Get NFT info by token ID
 *     parameters:
 *       - name: tokenId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Invalid token ID
 *       404:
 *         description: Token not found
 */
router.get('/metadata/nft-info/:tokenId', (req, res) => {
  const tokenId = parseInt(req.params.tokenId)
  if (isNaN(tokenId) || tokenId < 1) {
    return res.status(400).json({ error: 'Invalid token ID' })
  }

  const nftInfo = metadataService.getNftInfo(tokenId)
  if (!nftInfo) {
    return res.status(404).json({ error: 'Token not found' })
  }

  res.json({ success: true, data: nftInfo })
})

/**
 * @swagger
 * /metadata/revealed/{metadataId}:
 *   get:
 *     tags: [Metadata]
 *     summary: Get NFT metadata by metadata ID
 *     description: On-chain tokenURI and OpenSea use this path
 *     parameters:
 *       - name: metadataId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 4649
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenMetadata'
 *       400:
 *         description: Invalid metadata ID
 *       404:
 *         description: Token not found
 */
router.get('/metadata/revealed/:metadataId', (req, res) => {
  try {
    const metadataId = parseInt(req.params.metadataId)
    if (isNaN(metadataId) || metadataId < 1) {
      return res.status(400).json({ error: 'Invalid metadata ID' })
    }

    const metadata = metadataService.getTokenMetadataByMetadataId(metadataId)
    if (!metadata) {
      return res.status(404).json({ error: 'Token not found' })
    }

    res.json(metadata)
  } catch (error) {
    console.error(`Error getting metadata for metadataId ${req.params.metadataId}:`, error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

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
 *       404:
 *         description: Token not found
 */
router.get('/metadata/:tokenId', (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId)
    if (isNaN(tokenId) || tokenId < 1) {
      return res.status(400).json({ error: 'Invalid token ID' })
    }

    const metadata = metadataService.getTokenMetadata(tokenId)
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
 * /api/stats:
 *   get:
 *     tags: [Stats]
 *     summary: Get collection statistics
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/api/stats', (req, res) => {
  try {
    res.json({ success: true, data: metadataService.getStats() })
  } catch (error) {
    console.error('Error getting stats:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
