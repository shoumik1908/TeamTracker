const PdfPrinter = require('pdfmake/js/Printer').default;

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
