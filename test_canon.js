const path = require('path');
const { print, getPrinters } = require('pdf-to-printer');

async function testCanonPrinter() {
  try {
    console.log("Fetching connected printers list...");
    const printers = await getPrinters();
    
    const targetPrinter = "Canon iR2200-3300 PCL5e (Copy 1)";
    const printerExists = printers.find(p => p.name === targetPrinter);
    if (!printerExists) {
      console.error(`[ERROR] Printer "${targetPrinter}" not found!`);
      return;
    }

    // ನಿಮ್ಮ uploads ಫೋಲ್ಡರ್‌ನಲ್ಲಿರುವ ನಿಜವಾದ ಫೈಲ್ ಹೆಸರನ್ನು ಇಲ್ಲಿ ನೀಡಿ (ಉದಾಹರಣೆಗೆ lTyt.2.jpg ಬದಲಿಗೆ pdf ಇದ್ದರೆ pdf ನೀಡಿ)
    const testPdfPath = path.join(__dirname, 'uploads', 'LAVA2005.pdf'); // ನಿಮ್ಮ ಅಸ್ತಿತ್ವದಲ್ಲಿರುವ ಫೈಲ್ ಹೆಸರು

    console.log(`Sending test print to "${targetPrinter}" using file: ${testPdfPath}...`);
    
    await print(testPdfPath, {
      printer: targetPrinter,
      scale: "fit"
    });

    console.log("[SUCCESS] Test print sent successfully to Canon iR3300!");

  } catch (err) {
    console.error("[DRIVER/PRINT ERROR] Failed to print:");
    console.error(err);
  }
}

testCanonPrinter();