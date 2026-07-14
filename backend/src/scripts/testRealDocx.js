const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const paths = [
  'c:/Users/ShoumikKumar/Desktop/Meeting in KT - Landsec.docx',
  'c:/Users/ShoumikKumar/Desktop/Tracker/Meeting in KT - Landsec.docx',
  'c:/Users/ShoumikKumar/Meeting in KT - Landsec.docx'
];

async function main() {
  let foundPath = null;
  for (const p of paths) {
    if (fs.existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  if (!foundPath) {
    console.log("Could not find Meeting in KT - Landsec.docx in standard locations.");
    // Let's list the desktop folder!
    try {
      const files = fs.readdirSync('c:/Users/ShoumikKumar/Desktop');
      console.log("Desktop files:", files.filter(f => f.includes('Meeting') || f.includes('Landsec') || f.endsWith('.docx')));
    } catch (e) {
      console.error("Failed to read desktop:", e.message);
    }
    return;
  }

  console.log(`Found file at: ${foundPath}`);
  const buffer = fs.readFileSync(foundPath);
  console.log(`File size: ${buffer.length} bytes`);

  try {
    const result = await mammoth.extractRawText({ buffer });
    console.log("Extracted text successfully!");
    console.log(`Text length: ${result.value.length}`);
    console.log("Snippet:", result.value.substring(0, 200));
  } catch (err) {
    console.error("Mammoth failed on the real docx file:", err);
  }
}

main();
