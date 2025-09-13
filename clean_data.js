const fs = require('fs');
const path = require('path');

const rawDataPath = './case_data_raw';

try {
    const files = fs.readdirSync(rawDataPath);

    files.forEach((file, index) => {
        const filePath = path.join(rawDataPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const formattedJson = JSON.stringify(JSON.parse(rawData), null, 2);
            
            fs.writeFileSync(`case_data_clean/${file}`, formattedJson, 'utf8');

            // file cleaned
            console.log(`cleaned file ${index}: ${file}`);
        }
    })
} catch (error) {
    console.error('Error processing JSON:', error.message);
}