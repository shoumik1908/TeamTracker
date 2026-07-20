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
    { text: 'Member', style: 'header' },
    { text: 'Professional', style: 'subheader' },
    { text: '\nSummary', style: 'sectionHeader' },
    { text: 'Some summary text' },
    { text: '\nSkills', style: 'sectionHeader' },
    { ul: ['Skill 1', 'Skill 2'] }
  ],
  styles: {
    header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
    subheader: { fontSize: 14, bold: true, color: 'gray', margin: [0, 0, 0, 10] },
    sectionHeader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5], color: '#333' }
  },
  defaultStyle: {
    font: 'Roboto'
  }
};

try {
  const pdfDoc = printer.createPdfKitDocument(docDef);
  console.log("Success");
} catch (e) {
  console.error(e);
}
