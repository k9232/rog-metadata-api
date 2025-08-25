# Environment Variables

This document describes the environment variables required for the ROG Metadata API.

## Required Environment Variables

### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string
  - Format: `postgresql://username:password@host:port/database`
  - Example: `postgresql://rog_user:password@localhost:5432/rog_metadata_db`

### Blockchain Configuration
- `CONTRACT_ADDRESS`: Smart contract address for the ROG Blind Box contract
  - Format: Ethereum address (0x...)
  - Example: `0x1234567890123456789012345678901234567890`

- `RPC_URL`: Ethereum RPC endpoint
  - Format: HTTP/HTTPS URL
  - Example: `https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID`

- `SIGNER_PRIVATE_KEY`: Private key for signing transactions
  - Format: Hex string (without 0x prefix)
  - Example: `1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

### Metadata Configuration
- `METADATA_BASE_URI`: Base URI for metadata endpoints
  - Format: URL ending with /
  - Example: `https://your-domain.com/metadata/`

- `METADATA_SUFFIX`: File extension for metadata files
  - Default: `.json`
  - Example: `.json`

### Application Configuration
- `NODE_ENV`: Environment mode
  - Values: `development`, `production`
  - Default: `development`

- `PORT`: Server port
  - Default: `3000`
  - Example: `3000`

- `RANDOM_SEED_CHECK_INTERVAL`: Interval for checking random seed updates (milliseconds)
  - Default: `30000`
  - Example: `30000`

## Render Deployment

When deploying to Render, the following variables are automatically configured:
- `DATABASE_URL`: Automatically set from the PostgreSQL service
- `NODE_ENV`: Set to `production`

The following variables need to be manually configured in Render:
- `CONTRACT_ADDRESS`
- `RPC_URL`
- `SIGNER_PRIVATE_KEY`
- `METADATA_BASE_URI`

## Local Development

For local development, create a `.env` file in the root directory with the required variables:

```bash
# Copy the example and modify as needed
cp .env.example .env
```

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique passwords for database connections
- Keep private keys secure and never share them
- Use environment-specific RPC endpoints (testnet vs mainnet)
