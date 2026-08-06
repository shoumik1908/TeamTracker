const PdfPrinter = require('pdfmake/js/Printer').default;
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};
const printer = new PdfPrinter(fonts, null, { resolve: () => {}, resolved: () => Promise.resolve() });
const docDef = { content: [{ text: 'Hello', alignment: 'right' }] };

async function main() {
  try {
    const pdfDoc = await printer.createPdfKitDocument(docDef);
    console.log(typeof pdfDoc.on);
    
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => console.log('Done, size:', Buffer.concat(chunks).length));
    pdfDoc.end();
  } catch (e) {
    console.error(e);
  }
}
main();
