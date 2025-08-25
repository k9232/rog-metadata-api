/**
 * ROG Airdrop Import Script
 * 透過 API 批量導入 airdrop.csv 中的 Phase2 持有者資料
 * 使用方法: node import-airdrop.js
 */

const fs = require('fs')
const https = require('https')

// 配置
const API_URL = 'https://rog-metadata-api.onrender.com'
const BATCH_SIZE = 25 // 每批處理25個持有者 (Render 免費版建議較小批次)
const DELAY_MS = 2000 // 批次間延遲2秒

console.log(`🚀 ROG 空投資料導入工具`)
console.log(`🌐 API 地址: ${API_URL}`)
console.log(`📋 Swagger 文檔: ${API_URL}/api-docs\n`)

// 測試 API 連接
function testConnection() {
  return new Promise((resolve, reject) => {
    console.log('🔍 測試 API 連接...')
    
    const req = https.request(`${API_URL}/api/stats`, { method: 'GET' }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (res.statusCode === 200 && result.success) {
            console.log('✅ API 連接正常')
            resolve(true)
          } else {
            reject(new Error(`API 回應異常: ${res.statusCode}`))
          }
        } catch (e) {
          reject(new Error(`解析回應失敗: ${e.message}`))
        }
      })
    })
    
    req.on('error', reject)
    req.setTimeout(10000, () => reject(new Error('連接超時')))
    req.end()
  })
}

// 解析 CSV 文件
function parseCSV() {
  try {
    console.log('📖 讀取 airdrop.csv...')
    
    // 檢查文件是否存在 (優先使用 airdrop.csv，否則使用測試文件)
    let csvFile = './airdrop.csv'
    if (!fs.existsSync(csvFile)) {
      csvFile = './test-airdrop.csv'
      if (!fs.existsSync(csvFile)) {
        throw new Error('❌ 找不到 airdrop.csv 或 test-airdrop.csv 文件！')
      }
      console.log('⚠️  使用測試文件: test-airdrop.csv')
    }
    
    const data = fs.readFileSync(csvFile, 'utf8')
    const lines = data.split('\n')
    const holders = []
    
    // 跳過標題行，處理資料行
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const parts = line.split(',')
      if (parts.length >= 3) {
        const tokenId = parts[0].trim()
        const address = parts[1].trim()
        const boxTypeId = parts[2].trim()
        
        // 驗證資料格式
        if (tokenId && address && boxTypeId !== undefined) {
          // 確保地址格式正確
          if (address.match(/^0x[a-fA-F0-9]{40}$/)) {
            holders.push({
              userAddress: address,
              boxTypeId: parseInt(boxTypeId)
            })
          } else {
            console.warn(`⚠️  跳過無效地址: ${address} (行 ${i + 1})`)
          }
        }
      }
    }
    
    console.log(`✅ 解析完成，找到 ${holders.length} 個有效持有者`)
    return holders
  } catch (error) {
    console.error('❌ 讀取 CSV 文件失敗:', error.message)
    throw error
  }
}

// 批量導入持有者
function importBatch(holders) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ holders })
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    }
    
    const req = https.request(`${API_URL}/admin/batch-phase2-holders`, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (res.statusCode === 200 && result.success) {
            resolve(result)
          } else {
            reject(new Error(`API 錯誤: ${result.error || '未知錯誤'}`))
          }
        } catch (e) {
          reject(new Error(`解析回應失敗: ${e.message}`))
        }
      })
    })
    
    req.on('error', reject)
    req.setTimeout(30000, () => reject(new Error('請求超時')))
    req.write(postData)
    req.end()
  })
}

// 延遲函數
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 主導入函數
async function importAirdrop() {
  try {
    // 1. 測試連接
    await testConnection()
    
    // 2. 解析 CSV
    const allHolders = parseCSV()
    
    if (allHolders.length === 0) {
      console.log('❌ 沒有找到有效的持有者資料')
      return
    }
    
    // 3. 統計資料
    const stats = {}
    allHolders.forEach(holder => {
      const boxType = holder.boxTypeId
      stats[boxType] = (stats[boxType] || 0) + 1
    })
    
    console.log('\n📊 空投統計:')
    Object.keys(stats).forEach(boxTypeId => {
      const boxName = boxTypeId === '0' ? '金盒' : boxTypeId === '1' ? '紅盒' : boxTypeId === '2' ? '藍盒' : '其他'
      console.log(`  ${boxName} (${boxTypeId}): ${stats[boxTypeId]} 個持有者`)
    })
    
    // 4. 確認是否繼續
    console.log(`\n⚠️  即將導入 ${allHolders.length} 個持有者`)
    console.log(`📦 將分成 ${Math.ceil(allHolders.length / BATCH_SIZE)} 個批次處理`)
    console.log('按 Ctrl+C 取消，或等待 5 秒後開始...\n')
    
    // 倒數計時
    for (let i = 5; i > 0; i--) {
      process.stdout.write(`⏰ ${i} 秒後開始... \r`)
      await delay(1000)
    }
    console.log('🚀 開始導入！                    ')
    
    // 5. 分批導入
    let totalProcessed = 0
    let totalAdded = 0
    let errors = 0
    
    for (let i = 0; i < allHolders.length; i += BATCH_SIZE) {
      const batch = allHolders.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(allHolders.length / BATCH_SIZE)
      
      try {
        console.log(`📦 處理批次 ${batchNum}/${totalBatches} (${batch.length} 個持有者)...`)
        
        const result = await importBatch(batch)
        
        // 解析回應中的添加數量
        const addedMatch = result.message.match(/Added (\d+) Phase2 holders/)
        const addedCount = addedMatch ? parseInt(addedMatch[1]) : batch.length
        
        totalAdded += addedCount
        totalProcessed += batch.length
        
        console.log(`✅ 批次 ${batchNum} 完成: 成功添加 ${addedCount}/${batch.length} 個持有者`)
        
        // 進度條
        const progress = Math.round((totalProcessed / allHolders.length) * 100)
        console.log(`📈 總進度: ${totalProcessed}/${allHolders.length} (${progress}%)`)
        
        // 延遲避免 API 限制
        if (i + BATCH_SIZE < allHolders.length) {
          console.log(`⏳ 等待 ${DELAY_MS/1000} 秒...`)
          await delay(DELAY_MS)
        }
        
      } catch (error) {
        errors++
        console.error(`❌ 批次 ${batchNum} 失敗:`, error.message)
        
        // 如果連續失敗太多次，停止導入
        if (errors >= 3) {
          console.error('❌ 連續失敗次數過多，停止導入')
          break
        }
        
        // 失敗後等待更長時間再重試
        console.log('⏳ 等待 5 秒後繼續...')
        await delay(5000)
      }
    }
    
    // 6. 完成報告
    console.log('\n🎉 導入完成！')
    console.log('=====================================')
    console.log(`📋 總處理: ${totalProcessed} 個持有者`)
    console.log(`✅ 成功添加: ${totalAdded} 個持有者`)
    console.log(`❌ 失敗批次: ${errors} 個`)
    console.log(`📊 成功率: ${Math.round((totalAdded / totalProcessed) * 100)}%`)
    
    if (totalAdded > 0) {
      console.log(`\n🔗 您可以在 Swagger 中查看結果: ${API_URL}/api-docs`)
    }
    
  } catch (error) {
    console.error('❌ 導入過程失敗:', error.message)
    process.exit(1)
  }
}

// 主程序入口
async function main() {
  console.log('🏗️  ROG 空投資料導入工具 v1.0')
  console.log('=====================================\n')
  
  try {
    await importAirdrop()
  } catch (error) {
    console.error('💥 程序執行失敗:', error.message)
    process.exit(1)
  }
}

// 處理 Ctrl+C 中斷
process.on('SIGINT', () => {
  console.log('\n\n⚠️  用戶中斷導入過程')
  console.log('👋 再見！')
  process.exit(0)
})

// 啟動程序
main().catch(console.error)
