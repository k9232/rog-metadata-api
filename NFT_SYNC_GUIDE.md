# NFT Transfer Event Monitoring Guide

本指南說明如何使用新實作的 NFT Transfer 事件監聽和同步功能。

## 功能概述

系統現在可以：
1. 🎯 **實時監聽** ERC721 合約的 Transfer 事件
2. 🔄 **自動同步** mint 事件到 NftInfo 資料表
3. 📦 **歷史同步** 過去的 Transfer 事件
4. ⚙️ **管理介面** 控制和監控同步狀態

## 核心功能

### 1. Transfer 事件監聽
- 監聽合約的 `Transfer(address indexed from, address indexed to, uint256 indexed tokenId)` 事件
- 當 `from = 0x0000000000000000000000000000000000000000` 時識別為 mint 事件
- 自動更新 NftInfo 表中的擁有者地址

### 2. Mint 事件處理
當檢測到 mint 事件時，系統會：
- 檢查 mint 地址是否為 Phase2 持有者
- 檢查區塊時間是否在 publicStartTime 之後
- 創建新的 NftInfo 記錄，包含：
  - `tokenId`: NFT 的 token ID
  - `metadataId`: null (如需求所述)
  - `userAddress`: mint 到的地址
  - `boxTypeId`: 如果是 Phase2 持有者則使用其 boxTypeId，否則為 3
  - `originId`: 0 (如需求所述)
  - `createdAt`: 當前時間

### 3. boxTypeId 決定邏輯（優先級順序）
在處理 mint 事件時，系統按以下優先級決定 boxTypeId：

**優先級 1：區塊時間檢查**
- 如果區塊時間 > publicStartTime，直接設為 boxTypeId = 3
- 此條件具有最高優先級，無論是否為 Phase2 持有者

**優先級 2：Phase2 持有者檢查**（僅在區塊時間 ≤ publicStartTime 時）
- 查詢 Phase2Holders 表檢查 mint 地址是否為 Phase2 持有者
- 如果是 Phase2 持有者，使用其對應的 boxTypeId
- 如果不是 Phase2 持有者，boxTypeId 設為 3

**後備機制：**
- 如果無法獲取區塊時間，則回退到 Phase2 持有者檢查
- 如果沒有區塊號信息，則直接進行 Phase2 持有者檢查
- 在日誌中標記處理狀態（⏰、👑 或 👤）

### 4. 轉移事件處理
對於一般的轉移事件（非 mint），系統會：
- 更新現有 NftInfo 記錄的 `userAddress` 欄位
- 確保只有當前擁有者匹配時才更新

## 新增的服務

### NftSyncService (`src/services/nft-sync.ts`)
- 核心同步邏輯
- 處理 Transfer 事件
- 管理同步狀態
- 提供歷史同步功能

### 更新的 SchedulerService (`src/services/scheduler.ts`)
- 新增 NFT 同步調度功能
- 定期執行歷史同步以確保不遺漏事件
- 提供管理介面

### 更新的 BlockchainService (`src/services/blockchain.ts`)
- 新增 Transfer 事件監聽
- 新增歷史事件查詢功能
- 新增 `ownerOf` 函數支援

## 資料庫變更

### 新增 SyncStatus 表
```sql
CREATE TABLE sync_status (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) UNIQUE NOT NULL,
  last_processed_block INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

用於追蹤同步進度，避免重複處理相同的區塊。

## API 端點

### 管理端點

#### 1. 獲取同步狀態
```
GET /admin/nft-sync/status
```
返回當前同步狀態，包括：
- 是否正在監聽
- 最後處理的區塊
- 當前區塊
- 落後的區塊數

#### 2. 啟動 NFT 同步監控
```
POST /admin/nft-sync/start
```
啟動實時 Transfer 事件監聽和定期歷史同步。

#### 3. 停止 NFT 同步監控
```
POST /admin/nft-sync/stop
```
停止所有 NFT 同步活動。

#### 4. 強制同步
```
POST /admin/nft-sync/force-sync
```
手動觸發同步，可選參數：
- `fromBlock`: 起始區塊（可選）
- `toBlock`: 結束區塊（可選）

#### 5. 歷史同步
```
POST /admin/nft-sync/historical
```
同步指定區塊範圍的歷史事件：
- `fromBlock`: 起始區塊（必需）
- `toBlock`: 結束區塊（可選，預設為最新區塊）

## 環境變數

確保以下環境變數已設置：
- `CONTRACT_ADDRESS`: ERC721 合約地址
- `RPC_URL`: 區塊鏈 RPC 端點
- `DATABASE_URL`: PostgreSQL 資料庫連接字串

## 使用方式

### 1. 自動啟動
系統啟動時會自動開始 NFT 同步監控：
```javascript
// 在 app.ts 中自動啟動
await schedulerService.startNftSyncMonitoring()
```

### 2. 手動控制
透過管理 API 端點控制同步：
```bash
# 檢查狀態
curl http://localhost:3000/admin/nft-sync/status

# 啟動同步
curl -X POST http://localhost:3000/admin/nft-sync/start

# 停止同步
curl -X POST http://localhost:3000/admin/nft-sync/stop

# 強制同步
curl -X POST http://localhost:3000/admin/nft-sync/force-sync \
  -H "Content-Type: application/json" \
  -d '{"fromBlock": 1000000}'
```

### 3. 歷史同步
如需同步過去的事件：
```bash
curl -X POST http://localhost:3000/admin/nft-sync/historical \
  -H "Content-Type: application/json" \
  -d '{"fromBlock": 1000000, "toBlock": 1100000}'
```

## 監控和日誌

系統會輸出詳細的日誌信息：
- `🎯` NFT 同步監控啟動/停止
- `🎉` 檢測到 mint 事件
- `👑` Phase2 持有者 mint 事件
- `👤` 一般用戶 mint 事件
- `🔄` 檢測到轉移事件
- `✅` 成功處理事件
- `❌` 錯誤信息
- `📦` 歷史同步結果

## 錯誤處理

系統包含完善的錯誤處理：
- 區塊鏈連接失敗時會繼續重試
- 單個事件處理失敗不會影響其他事件
- 詳細的錯誤日誌便於除錯

## 性能考量

- 實時事件監聽提供即時更新
- 定期歷史同步確保不遺漏事件（預設每 60 秒）
- 同步狀態追蹤避免重複處理
- 批量處理歷史事件提高效率

## 測試

使用提供的測試腳本驗證功能：
```bash
node test-nft-sync.js
```

## 故障排除

### 常見問題

1. **區塊鏈服務未配置**
   - 檢查 `CONTRACT_ADDRESS` 和 `RPC_URL` 環境變數
   - 確保 RPC 端點可訪問

2. **資料庫連接問題**
   - 檢查 `DATABASE_URL` 環境變數
   - 確保 SyncStatus 表已創建

3. **事件未被處理**
   - 檢查合約地址是否正確
   - 確認 Transfer 事件格式匹配
   - 查看日誌中的錯誤信息

### 日誌級別
- `console.log`: 一般信息
- `console.warn`: 警告信息
- `console.error`: 錯誤信息

## 未來改進

可能的改進方向：
1. 支援多個合約同時監聽
2. 更細粒度的錯誤重試機制
3. 事件處理的優先級隊列
4. 更詳細的統計和監控指標
5. WebSocket 通知機制
