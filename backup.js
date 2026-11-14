const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 1. ಬ್ಯಾಕಪ್ ಫೋಲ್ಡರ್ ರಚಿಸುವುದು (Backup Folder)
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 2. ಡೇಟಾಬೇಸ್ ಕನೆಕ್ಷನ್
const db = new sqlite3.Database('./print_shop.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
});

// 3. ದಿನದ ದಿನಾಂಕವನ್ನು ಫೈಲ್ ಹೆಸರಿಗೆ ಸೇರಿಸಲು (YYYY-MM-DD)
const today = new Date().toISOString().split('T')[0];
const csvFilename = path.join(backupDir, `print_logs_${today}.csv`);

// 4. ಡೇಟಾಬೇಸ್‌ನಿಂದ ಎಲ್ಲಾ ಜಾಬ್‌ಗಳನ್ನು ಪಡೆದು CSV ಫೈಲ್ ಆಗಿ ಬರೆಯುವುದು
db.all(`SELECT * FROM jobs ORDER BY created_at DESC`, [], (err, rows) => {
  if (err) {
    console.error('Error fetching jobs:', err.message);
    db.close();
    return;
  }

  if (rows.length === 0) {
    console.log('No print logs found for backup.');
    db.close();
    return;
  }

  // CSV ಹೆಡರ್ (Headers)
  let csvContent = "Job ID,Filename,Original Name,Print Type,Paper Size,Print Side,Status,Created At\n";

  // ಪ್ರತಿ ರೋ ಅನ್ನು CSV ಫಾರ್ಮ್ಯಾಟ್‌ಗೆ ಪರಿವರ್ತಿಸುವುದು
  rows.forEach(row => {
    const line = `"${row.id}","${row.filename}","${row.original_name}","${row.print_type}","${row.paper_size}","${row.print_side}","${row.status}","${row.created_at}"\n`;
    csvContent += line;
  });

  // ಫೈಲ್ ಸೇವ್ ಮಾಡುವುದು
  fs.writeFileSync(csvFilename, csvContent, 'utf8');
  console.log(`[SUCCESS] Print logs successfully backed up to: ${csvFilename}`);

  db.close();
});