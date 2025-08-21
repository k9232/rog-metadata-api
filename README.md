# ROG Metadata API

簡潔的 NFT metadata API，監聽智能合約的隨機種子事件並生成 token 映射。

## 功能

- 🔗 監聽 `RandomSeedSet` 事件
- 🧮 根據智能合約算法生成 token -> metadata 映射
- 📊 存儲映射到 PostgreSQL 數據庫
- 🌐 提供 `/metadata/:tokenId` API endpoint

## 快速開始

1. **安裝依賴**
```bash
yarn install
```

2. **設置環境變數**
```bash
cp .env.example .env
# 編輯 .env 填入你的配置
```

3. **設置數據庫**
```bash
yarn db:push
yarn db:generate
```

4. **啟動開發服務器**
```bash
yarn dev
```

## 環境變數

```env
DATABASE_URL="postgresql://username:password@localhost:5432/rog_metadata"
CONTRACT_ADDRESS="0x..."
RPC_URL="https://eth-mainnet.alchemyapi.io/v2/your-api-key"
METADATA_BASE_URI="https://your-domain.com/metadata/"
METADATA_SUFFIX=".json"
PORT=3000
```

## API Endpoints

### GET /metadata/:tokenId

返回指定 token 的 metadata JSON。

**響應範例:**
```json
{
  "name": "ROG Avatar #1",
  "description": "ROG Avatar token #1", 
  "image": "https://your-domain.com/metadata/images/8.png",
  "external_url": "https://your-domain.com/metadata/8.json",
  "attributes": [
    {
      "trait_type": "Token ID",
      "value": 1
    },
    {
      "trait_type": "Metadata ID",
      "value": 8
    }
  ]
}
```

### GET /health

健康檢查 endpoint。

## 部署

### Render 部署

1. 連接你的 GitHub repo
2. 設置環境變數
3. 添加 PostgreSQL 服務
4. 部署！

構建命令: `yarn install && yarn db:generate && yarn build`
啟動命令: `yarn start`

## 工作原理

1. API 啟動時同步合約的當前隨機種子狀態
2. 如果已經 revealed，立即生成所有 token 映射
3. 監聽 `RandomSeedSet` 事件，當新種子設置時自動生成映射
4. 使用與智能合約相同的仿射置換算法確保一致性

## 算法

使用與智能合約相同的種子衍生仿射置換:
- `meta = (a * tokenIndex + b) mod N`
- 其中 `gcd(a, N) == 1` 確保雙射映射
