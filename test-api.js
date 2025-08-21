// 簡單的 API 測試腳本
// 使用方法: node test-api.js [API_URL]

const https = require('https');
const http = require('http');

const API_URL = process.argv[2] || 'http://localhost:3000';
const isHttps = API_URL.startsWith('https');
const client = isHttps ? https : http;

console.log(`🧪 測試 ROG Metadata API: ${API_URL}`);

// 測試健康檢查
function testHealth() {
  return new Promise((resolve, reject) => {
    const req = client.get(`${API_URL}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Health Check:', result.status);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
  });
}

// 測試根路徑
function testRoot() {
  return new Promise((resolve, reject) => {
    const req = client.get(`${API_URL}/`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Root Endpoint:', result.message);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
  });
}

// 測試 metadata 端點 (可能返回 404，這是正常的)
function testMetadata(tokenId = 1) {
  return new Promise((resolve, reject) => {
    const req = client.get(`${API_URL}/metadata/${tokenId}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 404) {
            console.log('⚠️  Metadata Endpoint: Token not found (expected if no NFTs created)');
          } else if (result.attributes && result.attributes.some(attr => attr.trait_type === 'Status' && attr.value === 'Unrevealed')) {
            console.log('📦 Metadata Endpoint: Blind box metadata (unrevealed)');
          } else {
            console.log('🎉 Metadata Endpoint: Revealed metadata');
          }
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
  });
}

// 測試統計端點
function testStats() {
  return new Promise((resolve, reject) => {
    const req = client.get(`${API_URL}/api/stats`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success) {
            console.log('📊 Stats Endpoint: Working -', 
              `Total: ${result.data.totalNfts}, Revealed: ${result.data.revealedNfts}`);
          }
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Timeout')));
  });
}

// 運行所有測試
async function runTests() {
  try {
    await testHealth();
    await testRoot();
    await testStats();
    await testMetadata();
    console.log('\n🎉 所有測試完成！');
    console.log('\n📋 可用的 API 端點:');
    console.log('- GET /metadata/:tokenId - 獲取 NFT metadata (盲盒或已解盲)');
    console.log('- POST /api/nft - 創建 NFT 信息');
    console.log('- GET /api/stats - 獲取統計信息');
    console.log('- GET /api/phase2/:address/:boxTypeId - 檢查 Phase2 持有者');
    console.log('- POST /admin/* - 管理員功能');
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    process.exit(1);
  }
}

runTests();
