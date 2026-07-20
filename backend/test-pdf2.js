const PdfPrinter = require('pdfmake');

const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);

const docDef = {
  content: [
    { text: 'Hello', alignment: 'right' }
  ]
};

try {
  const pdfDoc = printer.createPdfKitDocument(docDef);
  console.log("Success");
} catch (e) {
  console.error(e);
}
