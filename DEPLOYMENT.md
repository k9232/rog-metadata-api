# 🚀 Render 部署指南

## 步驟 1: 準備 GitHub Repository

1. 將代碼推送到 GitHub:
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

## 步驟 2: 在 Render 創建服務

### A. 創建 PostgreSQL 數據庫

1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 點擊 **"New +"** → **"PostgreSQL"**
3. 設置數據庫:
   - **Name**: `rog-metadata-db`
   - **Database**: `rog_metadata`
   - **User**: `rog_user` (或任意名稱)
   - **Region**: Singapore (或你偏好的區域)
   - **Plan**: Starter ($7/月)
4. 點擊 **"Create Database"**
5. **保存連接信息** (稍後需要用到)

### B. 創建 Web Service

1. 點擊 **"New +"** → **"Web Service"**
2. 連接 GitHub repository
3. 設置服務:
   - **Name**: `rog-metadata-api`
   - **Region**: Singapore (與數據庫同區域)
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**: `yarn install && yarn db:generate && yarn build`
   - **Start Command**: `yarn start`
   - **Plan**: Starter ($7/月)

## 步驟 3: 設置環境變數

在 Web Service 的 **Environment** 頁面添加:

### 必需的環境變數:

```env
NODE_ENV=production

# 數據庫 (從 PostgreSQL 服務複製)
DATABASE_URL=postgresql://rog_user:password@hostname:5432/rog_metadata

# 區塊鏈配置
CONTRACT_ADDRESS=0x你的合約地址
RPC_URL=https://eth-mainnet.alchemyapi.io/v2/你的API密鑰

# Metadata 配置
METADATA_BASE_URI=https://你的域名.com/metadata/
METADATA_SUFFIX=.json

# 服務器配置
PORT=10000
```

### 獲取 DATABASE_URL:
1. 進入你的 PostgreSQL 服務頁面
2. 在 **"Connections"** 區域找到 **"External Database URL"**
3. 複製完整的連接字串

## 步驟 4: 部署數據庫

數據庫遷移會在第一次部署時自動執行，因為我們在 `package.json` 中設置了 `postinstall` 腳本。

## 步驟 5: 測試部署

部署完成後，你的 API 會在以下 URL 可用:
```
https://rog-metadata-api.onrender.com
```

### 測試端點:

1. **健康檢查**:
```bash
curl https://rog-metadata-api.onrender.com/health
```

2. **獲取 metadata** (需要先有數據):
```bash
curl https://rog-metadata-api.onrender.com/metadata/1
```

## 步驟 6: 設置自定義域名 (可選)

1. 在 Web Service 設置中點擊 **"Custom Domains"**
2. 添加你的域名
3. 按照指示設置 DNS 記錄

## 🔧 故障排除

### 常見問題:

1. **構建失敗**:
   - 檢查 `yarn.lock` 文件是否包含在 repository 中
   - 確保所有依賴都在 `package.json` 中

2. **數據庫連接失敗**:
   - 確認 `DATABASE_URL` 格式正確
   - 檢查數據庫是否在同一區域

3. **環境變數問題**:
   - 確保所有必需的環境變數都已設置
   - 檢查變數名稱拼寫

### 查看日誌:
在 Render Dashboard 中點擊你的服務，然後查看 **"Logs"** 頁面。

## 🎯 生產環境優化

### 性能優化:
1. **升級計劃**: 考慮升級到更高的計劃以獲得更好的性能
2. **CDN**: 使用 CDN 來加速 metadata 圖片和 JSON 文件的加載
3. **監控**: 設置 Render 的監控和警報

### 安全性:
1. **HTTPS**: Render 自動提供 HTTPS
2. **環境變數**: 確保敏感信息都通過環境變數設置
3. **CORS**: 根據需要調整 CORS 設置

## 📊 監控和維護

1. **日誌監控**: 定期檢查應用日誌
2. **數據庫備份**: Render 會自動備份 PostgreSQL
3. **更新依賴**: 定期更新 npm 包和 Node.js 版本

## 🔄 CI/CD 自動部署

連接 GitHub 後，每次推送到 `main` 分支都會自動觸發部署。

要禁用自動部署:
1. 進入 Web Service 設置
2. 關閉 **"Auto Deploy"** 選項
