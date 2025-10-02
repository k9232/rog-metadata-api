# ROG NFT API - 鑄造系統 API 文檔

API Docs: https://rog-api.onrender.com/api-docs

## API 端點介紹

### 1. **鑄造配置 API** - `/api/mint/config`

**功能：** 獲取 NFT 鑄造合約參數

**請求方式：** `GET`

**完整 URL：** [https://rog-metadata-api.onrender.com/api/mint/config](https://rog-metadata-api.onrender.com/api/mint/config)

**回傳資料：**
```json
{
  "success": true,
  "data": {
    "chainId": 11155111,                    // 區塊鏈網路 ID (Sepolia 測試網)
    "nftAddress": "0x7c8614E7F475A95FB9362e8709B7623B556E0603",  // NFT 合約地址
    "soulboundStartTime": "2025-08-25T06:00:00.000Z",            // Soulbound 鑄造開始時間
    "soulboundEndTime": "2025-08-25T08:00:00.000Z",              // Soulbound 鑄造結束時間 (2小時後)
    "publicStartTime": "2025-08-25T10:00:00.000Z",               // 公開鑄造開始時間 (4小時後)
    "mintPrice": "0"                                              // 鑄造價格 (免費)
  }
}
```

**用途：** 前端應用程式可以透過這個 API 獲取鑄造活動的時間安排和合約資訊，用於顯示倒計時、控制鑄造按鈕的啟用狀態等。

---

### 2. **Soulbound 持有者鑄造資訊 API** - `/api/mint/soulbound/{address}`

**功能：** 查詢特定錢包地址的 Phase2 持有者鑄造資訊

**請求方式：** `GET`

**參數：**
- `address`: 以太坊錢包地址 (例如: `0x7950DEc0fCF39dD4Ed748f78d48Eeabc0f1b9eda`)

**完整 URL 範例：** `https://rog-metadata-api.onrender.com/api/mint/soulbound/0x7950DEc0fCF39dD4Ed748f78d48Eeabc0f1b9eda`

**成功回傳 (200)：**
```json
{
  "success": true,
  "data": {
    "id": 1,                                    // 資料庫記錄 ID
    "userAddress": "0x7950DEc0fCF39dD4Ed748f78d48Eeabc0f1b9eda",  // 錢包地址
    "signature": "0x...",                       // 鑄造簽名 (可能為 null)
    "boxTypeId": 1,                             // 盲盒類型 ID (0=金盒, 1=紅盒, 2=藍盒)
    "tokenId": 1,                               // phase2 持有者鑄造的 tokenId
    "createdAt": "2024-01-15T10:30:00.000Z"     // 記錄建立時間
  }
}
```

**失敗回傳 (404)：**
```json
{
  "success": false,
  "error": "No signatures found for this Phase2 holder"
}
```

**用途：** 
- 驗證用戶是否為 Phase2 持有者
- 獲取鑄造所需的簽名資訊
- 確認用戶可以鑄造的盲盒類型

---

### 3. **NFT 收藏品資訊 API** - `/api/nft`

**功能：** 獲取 NFT 收藏品的統計資訊

**請求方式：** `GET`

**完整 URL：** [https://rog-metadata-api.onrender.com/api/nft](https://rog-metadata-api.onrender.com/api/nft)

**回傳資料：**
```json
{
  "success": true,
  "data": {
    "totalSupply": 1500,                        // 目前已鑄造的 NFT 數量
    "maxSupply": 6020                           // 最大供應量
  }
}
```

**錯誤回傳 (500)：**
```json
{
  "error": "Internal server error"
}
```

**用途：** 
- 顯示收藏品的鑄造進度
- 計算剩餘可鑄造數量
- 提供收藏品稀有度參考資訊

---

## 🔧 Testnet

- **網路**: Sepolia 測試網 (Chain ID: 11155111)
- **NFT 合約**: `0x7c8614E7F475A95FB9362e8709B7623B556E0603`
- **鑄造價格**: 免費 (0 ETH)
- **API 基礎 URL**: `https://rog-metadata-api.onrender.com`

### 鑄造階段時間表

1. **Soulbound 階段** (Phase2 持有者專屬)
   - 開始時間：2025-08-25 06:00:00 UTC
   - 結束時間：2025-08-25 08:00:00 UTC
   - 持續時間：2小時

2. **公開鑄造階段**
   - 開始時間：2025-08-25 10:00:00 UTC
   - 持續時間：無限制

### 盲盒類型

- **0**: 金盒
- **1**: 紅盒  
- **2**: 藍盒

### 安全機制

系統會為 Phase2 持有者生成特殊的鑄造簽名，確保只有授權用戶能在 Soulbound 階段進行鑄造。簽名包含用戶地址、Token ID 和盲盒類型等資訊，防止未授權的鑄造行為。