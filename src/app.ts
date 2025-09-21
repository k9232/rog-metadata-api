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
import { schedulerService } from './services/scheduler'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

app.use(cors({
  origin: '*',
  credentials: false,
  // origin: true,
  // credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}))

app.use(express.json())

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ROG Metadata API',
      version: '2.0.0',
      description: 'ROG Blind Box Metadata API documentation'
    },
    servers: [
      { 
        url: process.env.NODE_ENV === 'production' 
          ? 'https://rog-metadata-api.onrender.com' 
          : `http://localhost:${PORT}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ]
  },
  apis: ['./src/routes/*.ts']
}

const swaggerSpec = swaggerJSDoc(swaggerOptions)

// Swagger UI configuration
const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ROG Metadata API Documentation',
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true
  }
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions))

// Serve swagger spec as JSON
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

// Handle preflight requests for Swagger UI
// app.options('*', cors())

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
        console.log('⏳ No random seed found, starting periodic monitoring...')
        // Start the scheduler to periodically check for random seed
        await schedulerService.startRandomSeedMonitoring()
      }
      
      // Keep the event listener as backup (in case websocket works better than polling)
      await blockchainService.startEventListener(async (randomSeed: bigint) => {
        console.log(`🎲 New random seed detected via event: ${randomSeed.toString()}`)
        // Stop scheduler since we got the seed via event
        schedulerService.stopRandomSeedMonitoring()
        const maxSupply = await blockchainService.getMaxSupply()
        await mappingService.generateAllMappings(randomSeed, maxSupply)
        console.log('🎉 Blind boxes revealed! Mappings generated.')
      })
    } catch (blockchainError) {
      const errorMessage = blockchainError instanceof Error ? blockchainError.message : String(blockchainError)
      console.warn('⚠️ Blockchain connection failed, API will start without blockchain features:', errorMessage)
      console.log('💡 This is normal if the smart contract is not deployed yet.')
      
      // Even if blockchain connection fails initially, start monitoring
      // The scheduler will handle connection retries
      console.log('🔄 Starting random seed monitoring with retry logic...')
      await schedulerService.startRandomSeedMonitoring()
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
