# Game-Only NFT Minting System

Bu sistem, NFT'lerin yalnızca oyun içinden mint edilebilmesini sağlayan imza tabanlı bir güvenlik yaklaşımı kullanır.

## 🔒 Güvenlik Sistemi Nasıl Çalışır?

1. **Oyun Tamamlandığında**: Kullanıcı oyunu oynar ve skor elde eder
2. **İmza İsteği**: Frontend, backend'den bir imza ister
3. **Backend Doğrulaması**: Backend skoru doğrular ve imza oluşturur
4. **Smart Contract Doğrulaması**: Smart contract imzayı doğrular ve mint işlemini gerçekleştirir

## 🚀 Kurulum

### 1. Smart Contract Dağıtımı

1. `TieredNFT.sol` dosyasını Remix'e kopyalayın
2. Contract'ı compile edin
3. Deploy ederken şu parametreleri verin:
   - `name`: "MonaPy Game NFT"  
   - `symbol`: "MONAPY"
   - `_baseTokenURI`: "https://your-metadata-url.com/metadata/"
   - `_gameSigner`: Backend'inizin imza adresi (aşağıda açıklanacak)

### 2. Backend Kurulumu

1. **Dependencies yükleyin**:
```bash
npm init -y
npm install express ethers cors dotenv
npm install -D nodemon
```

2. **Environment dosyası oluşturun**:
```bash
cp .env.example .env
```

3. **`.env` dosyasını düzenleyin**:
```env
# Yeni bir wallet oluşturun ve private key'ini buraya yazın
# ASLA ana cüzdanınızın private key'ini kullanmayın!
GAME_SIGNER_PRIVATE_KEY=0x1234...abcd
PORT=3001
```

4. **Backend'i başlatın**:
```bash
node backend-signature-server.js
```

### 3. Smart Contract Konfigürasyonu

1. Backend çalıştırıldığında console'da gösterilen `Game signer address`'i kopyalayın
2. Smart contract'ta `setGameSigner()` fonksiyonunu çağırarak bu adresi set edin:
```solidity
// Remix'te veya ethers.js ile:
await contract.setGameSigner("0xYourGameSignerAddress");
```

3. Sale'i aktif hale getirin:
```solidity
await contract.flipSaleState();
```

### 4. Frontend Konfigürasyonu

`src/config.ts` dosyasında backend URL'inizi güncelleyin:
```typescript
export const GAME_CONFIG = {
  BACKEND_URL: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-backend.com'  // Buraya production URL'inizi yazın
    : 'http://localhost:3001',
  
  CONTRACT_ADDRESS: "0xYourDeployedContractAddress", // Contract adresinizi buraya yazın
  
  MIN_SCORE_FOR_NFT: 750,
  SIGNATURE_TIMEOUT: 300,
};
```

## 📝 Nasıl Çalışır?

### Frontend Tarafı:
1. Kullanıcı oyunu tamamlar
2. `mintNFT()` fonksiyonu çağrılır
3. `getGameSignature()` ile backend'den imza istenir
4. İmza alınırsa smart contract'a gönderilir

### Backend Tarafı:
1. Player address, tier ve skor bilgilerini alır
2. Skorun tier'a uygun olup olmadığını kontrol eder
3. Rate limiting uygular (dakikada max 5 istek)
4. Ethers.js ile mesajı imzalar
5. İmzayı frontend'e döner

### Smart Contract Tarafı:
1. İmzayı doğrular (`ECDSA.recover`)
2. İmza game signer'dan gelip gelmediğini kontrol eder
3. Kullanıcının skorunun tier aralığında olup olmadığını kontrol eder
4. Supply ve per-address limitlerini kontrol eder
5. NFT'yi mint eder

## 🛡️ Güvenlik Özellikleri

### ✅ Bu Sistem Neyi Önler:
- **Direct ABI Calls**: Doğrudan contract'a mint çağrısı yapılması
- **Score Manipulation**: Frontend'te skor manipülasyonu
- **Tier Hijacking**: Yüksek tier'lara yetkisiz erişim
- **Batch Attacks**: Toplu mint saldırıları
- **Replay Attacks**: Aynı imzanın tekrar kullanılması

### 🔧 Ek Güvenlik Katmanları:
- **Rate Limiting**: Her adres için dakikada max 5 imza isteği
- **Timestamp Validation**: İsteklerin 5 dakika içinde olması gerekir
- **Score Range Validation**: Hem backend hem contract'ta skor kontrolü
- **Address Validation**: Ethereum adres formatı kontrolü
- **Supply Limits**: Tier başına maksimum supply
- **Per-Address Limits**: Kişi başına maksimum mint sayısı

## 🔄 API Endpoints

### `POST /api/get-mint-signature`
İmza üretir.

**Request:**
```json
{
  "playerAddress": "0x123...",
  "tierNumber": 5,
  "finalScore": 8500,
  "gameSessionId": 1234567890,
  "timestamp": 1640995200
}
```

**Response:**
```json
{
  "signature": "0xabcd1234...",
  "signerAddress": "0x789...",
  "message": "Signature generated for tier 5 NFT",
  "expires": 1640995500
}
```

### `GET /api/health`
Server durumunu kontrol eder.

### `GET /api/game-signer`
Game signer adresini döner (debug için).

## 📊 Tier Sistemi

| Tier | Name | Score Range | Supply | Price |
|------|------|-------------|---------|-------|
| 0 | Mythic | 20,000+ | 10 | 0.1 ETH |
| 1 | Legendary | 17,500-19,999 | 25 | 0.1 ETH |
| 2 | Diamond | 15,000-17,499 | 40 | 0.1 ETH |
| 3 | Platinum | 12,500-14,999 | 50 | 0.1 ETH |
| 4 | Gold | 10,000-12,499 | 100 | 0.1 ETH |
| 5 | Silver | 7,500-9,999 | 200 | 0.1 ETH |
| 6 | Bronze | 4,500-7,499 | 1,000 | 0.1 ETH |
| 7 | Regular | 750-4,499 | 9,999 | 0.1 ETH |

## 🐛 Debugging

### Backend Logları:
```bash
# Backend çalıştırıldığında:
Game signature server running on port 3001
Game signer address: 0x123...abc
Make sure to set this address in your smart contract using setGameSigner()

# İmza üretildiğinde:
Generated signature for 0x456...def, tier 5, score 8500
```

### Contract Events:
- `TierMinted`: NFT mint edildiğinde
- `ScoreUpdated`: Skor güncellendiğinde  
- `GameSignerUpdated`: Game signer değiştiğinde

### Common Errors:
- `"Invalid or missing game signature"`: İmza doğrulanamadı
- `"Score not in this tier range"`: Skor tier aralığında değil
- `"Failed to get game authorization"`: Backend'den imza alınamadı

## 🚨 Önemli Güvenlik Notları

1. **Private Key Güvenliği**: Game signer private key'ini asla git'e commit etmeyin
2. **Wallet Separation**: Game signing için ayrı bir wallet kullanın
3. **HTTPS**: Production'da mutlaka HTTPS kullanın
4. **Rate Limiting**: Backend'te rate limiting aktif olduğundan emin olun
5. **Environment Variables**: Tüm hassas bilgileri environment variables'da tutun

## 📈 Production Deployment

### Backend:
1. Heroku, Railway, Vercel gibi platformlara deploy edin
2. Environment variables'ları set edin
3. CORS ayarlarını production domain'inizle güncelleyin

### Frontend:
1. `GAME_CONFIG.BACKEND_URL`'yi production URL'inize güncelleyin
2. `GAME_CONFIG.CONTRACT_ADDRESS`'i deploy ettiğiniz contract adresiyle güncelleyin

Bu sistem sayesinde NFT'lerinizi sadece oyun içinden mint ettirip, dış saldırıları önleyebilirsiniz! 🎮🔒
