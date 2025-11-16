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
import { MINT_CONFIG } from './config/contracts'

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
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-admin-key']
}))

app.use(express.json())

const isProduction = process.env.NODE_ENV === 'production';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ROG Metadata API',
      version: '2.0.0',
      description: `
        # ROG Blind Box Metadata API
        
        This API provides endpoints for managing ROG NFT metadata, Phase 2 holder verification, 
        and administrative functions for the ROG blind box collection.
        
        ## Box Types
        - **0**: 金盒 (Gold Box)
        - **1**: 紅盒 (Red Box) 
        - **2**: 藍盒 (Blue Box)
        - **3**: 公售盒 (Public Sale Box)
        
        ## Authentication
        Admin endpoints require an API key to be passed in the \`x-admin-key\` header.
      `,
      contact: {
        name: 'ROG Team',
        url: 'https://github.com/your-org/rog-metadata-api'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      { 
        url: isProduction 
          ? 'https://rog-api.onrender.com' 
          : `http://localhost:${PORT}`,
        description: isProduction ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        AdminApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-admin-key',
          description: 'Admin API key for accessing administrative endpoints'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            success: {
              type: 'boolean',
              example: false
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            }
          }
        },
        TokenMetadata: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'ROG Avatar #1'
            },
            description: {
              type: 'string',
              example: 'A unique ROG avatar NFT'
            },
            image: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/image.png'
            },
            attributes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  trait_type: {
                    type: 'string',
                    example: 'Background'
                  },
                  value: {
                    type: 'string',
                    example: 'Blue'
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Metadata',
        description: 'NFT metadata operations'
      },
      {
        name: 'NFT',
        description: 'NFT collection and token operations'
      },
      {
        name: 'Mint',
        description: 'Minting configuration and Phase 2 holder operations'
      },
      {
        name: 'Stats',
        description: 'Collection statistics'
      },
      {
        name: 'Admin',
        description: 'Administrative operations (requires API key)'
      }
    ]
  },
  apis: ['./src/routes/*.ts']
}

const swaggerSpec = swaggerJSDoc(swaggerOptions)

// Swagger UI configuration
const swaggerUiOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin-bottom: 30px }
    .swagger-ui .scheme-container { background: #f7f7f7; padding: 10px; border-radius: 4px; margin-bottom: 20px }
  `,
  customSiteTitle: 'ROG Metadata API Documentation',
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2
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
  const baseUrl = isProduction 
    ? 'https://rog-api.onrender.com' 
    : `http://localhost:${PORT}`
    
  res.json({ 
    message: 'ROG Blind Box Metadata API is running!',
    version: '2.0.0',
    documentation: `${baseUrl}/api-docs`,
    swagger: `${baseUrl}/swagger.json`,
    endpoints: {
      metadata: '/metadata/:tokenId',
      nftInfo: 'GET /api/nft',
      createNft: 'POST /api/nft',
      stats: '/api/stats',
      mintConfig: '/api/mint/config',
      phase2Holder: '/api/mint/soulbound/:address',
      admin: {
        randomSeedStatus: '/admin/random-seed-status',
        syncRandomSeed: 'POST /admin/sync-randomseed',
        createBlindBoxMetadata: 'POST /admin/blind-box-metadata',
        createOriginMetadata: 'POST /admin/origin-metadata',
        addPhase2Holder: 'POST /admin/phase2-holder',
        detailedStats: '/admin/detailed-stats',
        scheduler: {
          status: '/admin/scheduler/status',
          start: 'POST /admin/scheduler/start',
          stop: 'POST /admin/scheduler/stop',
          forceCheck: 'POST /admin/scheduler/force-check'
        },
        nftSync: {
          status: '/admin/nft-sync/status',
          start: 'POST /admin/nft-sync/start',
          stop: 'POST /admin/nft-sync/stop',
          forceSync: 'POST /admin/nft-sync/force-sync',
          historical: 'POST /admin/nft-sync/historical'
        }
      }
    },
    boxTypes: {
      0: '金盒 (Gold Box)',
      1: '紅盒 (Red Box)', 
      2: '藍盒 (Blue Box)',
      3: '公售盒 (Public Sale Box)'
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

    // const maxSupply = await blockchainService.getMaxSupply();
    // await mappingService.generateAllMappings(BigInt(MINT_CONFIG.randomSeed), maxSupply)
    // console.log('✅ Mappings generated for existing NFTs')

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

      // Start NFT Transfer event monitoring
      console.log('🎯 Starting NFT Transfer event monitoring...')
      await schedulerService.startNftSyncMonitoring()
      
      // Keep the event listener as backup (in case websocket works better than polling)
      // await blockchainService.startEventListener(async (randomSeed: bigint) => {
      //   console.log(`🎲 New random seed detected via event: ${randomSeed.toString()}`)
      //   // Stop scheduler since we got the seed via event
      //   schedulerService.stopRandomSeedMonitoring()
      //   const maxSupply = await blockchainService.getMaxSupply()
      //   await mappingService.generateAllMappings(randomSeed, maxSupply)
      //   console.log('🎉 Blind boxes revealed! Mappings generated.')
      // })
    } catch (blockchainError) {
      const errorMessage = blockchainError instanceof Error ? blockchainError.message : String(blockchainError)
      console.warn('⚠️ Blockchain connection failed, API will start without blockchain features:', errorMessage)
      console.log('💡 This is normal if the smart contract is not deployed yet.')
      
      // Even if blockchain connection fails initially, start monitoring
      // The scheduler will handle connection retries
      console.log('🔄 Starting random seed monitoring with retry logic...')
      await schedulerService.startRandomSeedMonitoring()
      
      // Also start NFT sync monitoring even if initial connection fails
      console.log('🔄 Starting NFT sync monitoring with retry logic...')
      await schedulerService.startNftSyncMonitoring()
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
