import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import swaggerJSDoc from 'swagger-jsdoc'
import metadataRoutes from './routes/metadata'
import { loadCatalog } from './data/catalog'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const isProduction = process.env.NODE_ENV === 'production'

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept']
}))

app.use(express.json())

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SLASH206 ZEI-6 Metadata API',
      version: '3.0.0',
      description: 'Static ERC-721 metadata for the SLASH206 - ZEI-6 collection.'
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
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        TokenMetadata: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'ZEI-6-MM8872' },
            description: { type: 'string' },
            image: { type: 'string', format: 'uri' },
            external_url: { type: 'string', format: 'uri' },
            attributes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  trait_type: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      { name: 'Metadata', description: 'NFT metadata' },
      { name: 'Stats', description: 'Collection statistics' }
    ]
  },
  apis: ['./src/routes/*.ts']
}

const swaggerSpec = swaggerJSDoc(swaggerOptions)

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'SLASH206 ZEI-6 Metadata API'
}))

app.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

app.use('/', metadataRoutes)

app.get('/', (_req, res) => {
  const baseUrl = isProduction
    ? 'https://rog-api.onrender.com'
    : `http://localhost:${PORT}`

  res.json({
    message: 'SLASH206 ZEI-6 Metadata API is running',
    version: '3.0.0',
    documentation: `${baseUrl}/api-docs`,
    swagger: `${baseUrl}/swagger.json`,
    endpoints: {
      metadata: '/metadata/:tokenId',
      revealed: '/metadata/revealed/:metadataId',
      nftInfo: '/metadata/nft-info/:tokenId',
      stats: '/api/stats',
      health: '/health'
    }
  })
})

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0'
  })
})

const startServer = () => {
  try {
    loadCatalog()
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export default app
