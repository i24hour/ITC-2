const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Common bin location format: A-01, A-02, ... Z-99
// Generate for aisles A through Z, bins 01 through 50
const generateBinLocations = () => {
    const locations = [];
    
    // Generate A-01 to Z-50
    for (let letter = 65; letter <= 90; letter++) { // A-Z (65-90)
        const aisle = String.fromCharCode(letter);
        for (let num = 1; num <= 50; num++) {
            const binNum = num.toString().padStart(2, '0');
            locations.push(`${aisle}-${binNum}`);
        }
    }
    
    return locations;
};

const generateQRCodes = async () => {
    const binDir = path.join(__dirname, 'BIN');
    
    // Create BIN directory if it doesn't exist
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }
    
    const locations = generateBinLocations();
    console.log(`🎯 Generating QR codes for ${locations.length} bin locations...`);
    
    let generated = 0;
    let failed = 0;
    
    for (const location of locations) {
        try {
            const filePath = path.join(binDir, `${location}.png`);
            
            // Generate QR code with bin location text
            await QRCode.toFile(filePath, location, {
                errorCorrectionLevel: 'H',
                type: 'png',
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            generated++;
            
            // Show progress every 100 QR codes
            if (generated % 100 === 0) {
                console.log(`✅ Generated ${generated}/${locations.length} QR codes...`);
            }
        } catch (err) {
            console.error(`❌ Failed to generate QR for ${location}:`, err.message);
            failed++;
        }
    }
    
    console.log('\n📊 Generation Summary:');
    console.log(`✅ Successfully generated: ${generated} QR codes`);
    if (failed > 0) {
        console.log(`❌ Failed: ${failed} QR codes`);
    }
    console.log(`📁 Location: ${binDir}`);
    console.log('\n✨ All bin QR codes are ready!');
};

// Run the generator
generateQRCodes().catch(err => {
    console.error('❌ Error generating QR codes:', err);
    process.exit(1);
});
