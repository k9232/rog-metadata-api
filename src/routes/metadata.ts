import { Router } from 'express'
import { MetadataService } from '../services/metadata'
import { MappingService } from '../services/mapping'

const router = Router()
const metadataService = new MetadataService()
const mappingService = new MappingService()

// 獲取 Token Metadata
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

// 創建 NFT 信息（供合約調用）
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

// 獲取統計信息
router.get('/api/stats', async (req, res) => {
  try {
    const stats = await metadataService.getStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error('Error getting stats:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// 檢查 Phase2 持有者
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
