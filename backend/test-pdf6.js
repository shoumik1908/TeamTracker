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
const pdfDoc = printer.createPdfKitDocument(docDef);
console.log(Object.keys(pdfDoc));
