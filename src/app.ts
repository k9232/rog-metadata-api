import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import metadataRoutes from './routes/metadata'
import adminRoutes from './routes/admin'
import swaggerUi from 'swagger-ui-express'
import swaggerJSDoc from 'swagger-jsdoc'
import { BlockchainService } from './services/blockchain'
import { MappingService } from './services/mapping'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(helmet())
app.use(cors())
app.use(express.json())

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ROG Metadata API',
      version: '2.0.0',
      description: 'ROG Blind Box Metadata API documentation'
    },
    // servers: [{ url: 'https://your-render-url.com' }]
    servers: [{ url: 'https://rog-metadata-api.onrender.com' }]
  },
  apis: ['./src/routes/*.ts']
}

const swaggerSpec = swaggerJSDoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/', metadataRoutes)
app.use('/', adminRoutes)

app.get('/', (req, res) => {
  res.json({ 
    message: 'ROG Blind Box Metadata API is running!',
    version: '2.0.0',
    endpoints: {
      metadata: '/metadata/:tokenId',
      createNft: 'POST /api/nft',
      stats: '/api/stats',
      phase2Check: '/api/phase2/:address/:boxTypeId',
      admin: {
        randomSeedStatus: '/admin/random-seed-status',
        syncRandomSeed: 'POST /admin/sync-randomseed',
        createBlindBoxMetadata: 'POST /admin/blind-box-metadata',
        createOriginMetadata: 'POST /admin/origin-metadata',
        addPhase2Holder: 'POST /admin/phase2-holder',
        detailedStats: '/admin/detailed-stats'
      }
    },
    boxTypes: {
      0: '金盒',
      1: '紅盒', 
      2: '藍盒',
      3: '公售盒'
    }
  })
})

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  })
})

const blockchainService = new BlockchainService()
const mappingService = new MappingService()

const startServer = async () => {
  try {
    console.log('🚀 Starting ROG Blind Box Metadata API...')
    
    try {
      const existingSeed = await blockchainService.syncRandomSeedFromContract()
      
      if (existingSeed) {
        console.log(`📦 Found existing random seed: ${existingSeed.toString()}`)
        const maxSupply = await blockchainService.getMaxSupply()
        await mappingService.generateAllMappings(existingSeed, maxSupply)
        console.log('✅ Mappings generated for existing NFTs')
      } else {
        console.log('⏳ No random seed found, waiting for RandomSeedSet event...')
      }
      
      await blockchainService.startEventListener(async (randomSeed: bigint) => {
        console.log(`🎲 New random seed detected: ${randomSeed.toString()}`)
        const maxSupply = await blockchainService.getMaxSupply()
        await mappingService.generateAllMappings(randomSeed, maxSupply)
        console.log('🎉 Blind boxes revealed! Mappings generated.')
      })
    } catch (blockchainError) {
      const errorMessage = blockchainError instanceof Error ? blockchainError.message : String(blockchainError)
      console.warn('⚠️ Blockchain connection failed, API will start without blockchain features:', errorMessage)
      console.log('💡 This is normal if the smart contract is not deployed yet.')
    }
    
    app.listen(PORT, () => {
      console.log(`🌐 Server is running on port ${PORT}`)
      console.log(`📡 Contract address: ${process.env.CONTRACT_ADDRESS || 'Not set'}`)
      console.log(`📋 API Documentation available at: http://localhost:${PORT}/`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export default app
