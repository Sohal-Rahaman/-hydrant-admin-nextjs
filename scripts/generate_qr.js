const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'jar_qr');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateQRs() {
  console.log('🚀 Starting QR Generation (500 Jars)...');
  
  for (let i = 1; i <= 500; i++) {
    const jarId = `HYD-JAR-${i.toString().padStart(4, '0')}`;
    const url = `https://hydrant.co.in/jar?id=${jarId}`;
    const filePath = path.join(outputDir, `${jarId}.png`);
    
    try {
      await QRCode.toFile(filePath, url, {
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 600,
        margin: 2
      });
      if (i % 50 === 0) {
        console.log(`✅ Generated ${i}/500: ${jarId}`);
      }
    } catch (err) {
      console.error(`❌ Error generating ${jarId}:`, err);
    }
  }
  
  console.log('✨ Done! 500 QR codes saved in scripts/jar_qr folder.');
}

generateQRs();
