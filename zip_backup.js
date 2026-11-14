const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 1. ಬ್ಯಾಕಪ್ ಸೇವ್ ಆಗಲು ಫೋಲ್ಡರ್ ಸೃಷ್ಟಿಸುವುದು
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 2. ದಿನಾಂಕ ಮತ್ತು ಸಮಯದೊಂದಿಗೆ ಜಿಪ್ ಫೈಲ್ ಹೆಸರು (ಉದಾ: backup_2026-11-04.zip)
const today = new Date().toISOString().split('T')[0];
const zipFileName = `print_shop_backup_${today}.zip`;
const zipFilePath = path.join(backupDir, zipFileName);

// 3. ಔಟ್‌ಪುಟ್ ಸ್ಟ್ರೀಮ್ ಮತ್ತು ಆರ್ಕೈವರ್ ಸೆಟಪ್
const output = fs.createWriteStream(zipFilePath);
const archive = archiver('zip', {
  zlib: { level: 9 } // ಅತ್ಯುತ್ತಮ ಕಂಪ್ರೆಷನ್ ಲೆವೆಲ್
});

output.on('close', () => {
  console.log(`[SUCCESS] Full backup created successfully!`);
  console.log(`File Name: ${zipFileName}`);
  console.log(`Total Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// 4. ಡೇಟಾಬೇಸ್ ಫೈಲ್ ಅನ್ನು ಜಿಪ್‌ಗೆ ಸೇರಿಸುವುದು
const dbPath = path.join(__dirname, 'print_shop.db');
if (fs.existsSync(dbPath)) {
  archive.file(dbPath, { name: 'print_shop.db' });
}

// 5. ಅಪ್ಲೋಡ್ಸ್ ಫೋಲ್ಡರ್‌ನಲ್ಲಿರುವ ಎಲ್ಲಾ ಡಾಕ್ಯುಮೆಂಟ್ಸ್‌ಗಳನ್ನು ಜಿಪ್‌ಗೆ ಸೇರಿಸುವುದು
const uploadsPath = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsPath)) {
  archive.directory(uploadsPath, 'uploads');
}

// ಪ್ರಕ್ರಿಯೆ ಪೂರ್ಣಗೊಳಿಸುವುದು
archive.finalize();