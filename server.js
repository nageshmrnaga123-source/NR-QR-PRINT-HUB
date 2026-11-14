const path = require('path');
// NR QR PRINT SHOP - server.js
// Install: npm install express multer sqlite3 ws pdf-to-printer


const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const { print, getPrinters } = require('pdf-to-printer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 5000;
const HOST = '0.0.0.0';
const ROOT_DIR = __dirname;
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const DB_PATH = path.join(ROOT_DIR, 'print_shop.db');

// Create uploads folder if it does not exist.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
let isShopOpen = true;
let currentAdminOtp = null;
app.post('/api/send-otp', express.json(), (req, res) => {
    currentAdminOtp = Math.floor(1000 + Math.random() * 9000).toString();
    console.log('\n=========================================');
    console.log('🔐 NR COMPUTERS ADMIN RESET OTP:', currentAdminOtp);
    console.log('=========================================\n');
    res.json({ success: true, otp: currentAdminOtp, message: 'OTP ನಿಮ್ಮ ಸರ್ವರ್ ಟರ್ಮಿನಲ್‌ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ!' });
});
app.post('/api/verify-otp', express.json(), (req, res) => {
    if (currentAdminOtp && req.body.otp === currentAdminOtp) {
        currentAdminOtp = null;
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'ತಪ್ಪಾದ OTP! ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' });
    }
});
app.get('/api/shop-status', (req, res) => res.json({ open: isShopOpen }));
app.post('/api/shop-status', express.json(), (req, res) => {
    isShopOpen = Boolean(req.body.open);
    res.json({ success: true, open: isShopOpen });
}); // à²…à²¥à²µà²¾ à²¨à²¿à²®à³à²® à²ªà³à²°à²¾à²œà³†à²•à³à²Ÿà³ à²°à³‚à²Ÿà³ à²«à³‹à²²à³à²¡à²°à³
app.use('/downloads', express.static(UPLOAD_DIR));

// SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        filepath TEXT NOT NULL,
        print_type TEXT DEFAULT 'bw',
        paper_size TEXT DEFAULT 'A4',
        print_side TEXT DEFAULT 'single',
        status TEXT DEFAULT 'PENDING',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) console.error('Table creation error:', err.message);
});

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const safeOriginalName = path.basename(file.originalname)
            .replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeOriginalName}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB à²µà²°à³†à²—à³†
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        // PDF à²…à²¥à²µà²¾ à²‡à²®à³‡à²œà³ à²«à³ˆà²²à³â€Œà²—à²³à²¿à²—à³† à²®à²¾à²¤à³à²° à²…à²¨à³à²®à²¤à²¿
        if (ext === '.pdf' || ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
            cb(null, true);
        } else {
            return cb(new Error('à²¦à²¯à²µà²¿à²Ÿà³à²Ÿà³ à²•à³‡à²µà²² PDF à²…à²¥à²µà²¾ à²‡à²®à³‡à²œà³ (JPG, PNG) à²«à³ˆà²²à³â€Œà²—à²³à²¨à³à²¨à³ à²®à²¾à²¤à³à²° à²…à²ªà³â€Œà²²à³‹à²¡à³ à²®à²¾à²¡à²¿.'));
        }
    }
});
// Send updates to connected admin dashboards
function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
function selectPrintSide(side) {
    document.getElementById('inputPrintSide').value = side;
    if (side === 'single') {
        document.getElementById('btnSideSingle').classList.add('active');
        document.getElementById('btnSideBoth').classList.remove('active');
    } else {
        document.getElementById('btnSideBoth').classList.add('active');
        document.getElementById('btnSideSingle').classList.remove('active');
    }
}
// Customer upload page
app.get('/customer', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'customer.html'));
});
// Upload a print job with Auto Page Count & Pricing
app.post('/upload', upload.single('document'), async (req, res) => {
    if (!isShopOpen) return res.status(403).json({ success: false, error: 'ಕ್ಷಮಿಸಿ, ಅಂಗಡಿ ಮುಚ್ಚಿದೆ (Shop Closed).' });
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded.'
        });
    }

    const printType = req.body.printType || 'bw';
    const copies = parseInt(req.body.copies) || 1;
    const paperSize = req.body.paperSize || 'A4';
    const printSide = req.body.printSide || 'single';
    const jobId = `JOB_${Date.now()}`;

    let pageCount = 1;
    try {
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        pageCount = pdfData.numpages || 1;
    } catch (e) {
        console.log('PDF Parse error (defaulting to 1 page):', e.message);
    }

    // à²¬à³†à²²à³† à²²à³†à²•à³à²•à²¾à²šà²¾à²°: (à²ªà³à²°à²¤à²¿ à²ªà³à²Ÿà²¦ à²¬à³†à²²à³† Ã— à²ªà³à²Ÿà²—à²³ à²¸à²‚à²–à³à²¯à³† Ã— à²•à²¾à²ªà²¿à²—à²³ à²¸à²‚à²–à³à²¯à³†)
    const ratePerPageIndex = (printType === 'color') ? 10 : 5;
    const totalAmount = ratePerPageIndex * pageCount * copies;

    const job = {
        id: jobId,
        filename: req.file.filename,
        original_name: req.file.originalname,
        filepath: req.file.path,
        print_type: printType,
        paper_size: paperSize,
        print_side: printSide,
        pages: pageCount,
        copies: copies,
        total_amount: totalAmount,
        status: 'PENDING'
    };

    db.run(
        `INSERT INTO jobs 
         (id, filename, original_name, filepath, print_type, paper_size, print_side, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [job.id, job.filename, job.original_name, job.filepath, job.print_type, job.paper_size, job.print_side, job.status],
        function (err) {
            if (err) {
                console.error('Database save error:', err.message);
                return res.status(500).json({ success: false, error: 'Could not save print job.' });
            }
            broadcast({ event: 'NEW_PRINT_JOB', payload: job });
            return res.status(201).json({
                success: true,
                message: 'à²«à³ˆà²²à³ à²¯à²¶à²¸à³à²µà²¿à²¯à²¾à²—à²¿ à²…à²ªà³â€Œà²²à³‹à²¡à³ à²†à²—à²¿à²¦à³†.',
                token: job.id,
                job
            });
        }
    );
});
// Get all print jobs
app.get('/api/jobs', (req, res) => {
    db.all('SELECT * FROM jobs ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json(rows);
    });
});

// Update job status
app.post('/api/jobs/status', (req, res) => {
    const { id, status } = req.body;
    const allowedStatuses = ['PENDING', 'PRINTING', 'PRINTED', 'CANCELLED', 'FAILED'];

    if (!id || !allowedStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            error: 'Valid job id and status are required.'
        });
    }

    db.run('UPDATE jobs SET status = ? WHERE id = ?', [status, id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Job not found.' });
        }

        broadcast({ event: 'JOB_STATUS_UPDATED', payload: { id, status } });
        res.json({ success: true });
    });
});

// Delete a job
app.delete('/api/jobs/:id', (req, res) => {
    const jobId = req.params.id;

    db.get('SELECT filepath FROM jobs WHERE id = ?', [jobId], (findErr, job) => {
        if (findErr) {
            return res.status(500).json({ success: false, error: findErr.message });
        }
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found.' });
        }

        db.run('DELETE FROM jobs WHERE id = ?', [jobId], function (deleteErr) {
            if (deleteErr) {
                return res.status(500).json({ success: false, error: deleteErr.message });
            }

            fs.unlink(job.filepath, () => {});
            broadcast({ event: 'JOB_DELETED', payload: { id: jobId } });
            res.json({ success: true });
        });
    });
});

// List installed printers
app.get('/api/printers', async (req, res) => {
    try {
        const printers = await getPrinters();
        res.json(printers);
    } catch (err) {
        console.error('Printer list error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Send a PDF job to the selected printer
app.post('/api/print-hardware', (req, res) => {
    const { id, printerName } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: 'Job id is required.' });
    }

    db.get('SELECT * FROM jobs WHERE id = ?', [id], async (err, job) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found.' });
        }
        if (!fs.existsSync(job.filepath)) {
            return res.status(404).json({ success: false, error: 'Uploaded file is missing.' });
        }

        try {
            const options = printerName ? { printer: printerName } : {};
            await print(job.filepath, options);

            db.run(
                "UPDATE jobs SET status = 'PRINTED' WHERE id = ?",
                [id],
                (updateErr) => {
                    if (updateErr) {
                        console.error('Could not update print status:', updateErr.message);
                    }
                }
            );

            broadcast({ event: 'JOB_STATUS_UPDATED', payload: { id, status: 'PRINTED' } });
            res.json({ success: true, message: `Job ${id} sent to printer.` });
        } catch (printErr) {
            console.error('Printing failed:', printErr);
            db.run("UPDATE jobs SET status = 'FAILED' WHERE id = ?", [id]);
            res.status(500).json({ success: false, error: printErr.message });
        }
    });
});

// Upload error handler
app.use((err, req, res, next) => {
    console.error('Request error:', err.message);
    res.status(400).json({ success: false, error: err.message });
});

// WebSocket connection
wss.on('connection', (socket) => {
    console.log('Admin dashboard connected through WebSocket.');
    socket.send(JSON.stringify({ event: 'CONNECTED', payload: { message: 'Connected' } }));
    socket.on('error', (err) => console.error('WebSocket error:', err.message));
});

// Start server
server.listen(PORT, HOST, () => {
    console.log('==============================================');
    console.log(' NR QR PRINT SHOP SERVER IS RUNNING');
    console.log(` Local:   http://localhost:${PORT}`);
    console.log(` Network: http://YOUR-PC-IP:${PORT}`);
    console.log(' Customer page: /customer');
    console.log('==============================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
    server.close(() => {
        db.close(() => process.exit(0));
    });
});






