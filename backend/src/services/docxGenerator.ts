import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType } from 'docx';

export async function createCvDocx(
  profile: any,
  tailoredSummary?: string,
  tailoredSkills?: string[],
  tailoredProjects?: any[],
  tailoredSkillsGrouped?: any[],
  tailoredCerts?: string[]
): Promise<Buffer> {
  const summary = tailoredSummary || profile.summary || '';
  const skillsGrouped = tailoredSkillsGrouped || profile.skillsGrouped || [];
  const projects = tailoredProjects || profile.projects || [];
  const certs = tailoredCerts || profile.certifications || [];
  
  const name = profile.member?.name || 'Professional Name';
  const role = profile.primaryRole || profile.member?.designation || 'Data Engineer';
  const email = profile.member?.email || 'email@example.com';
  const phone = profile.member?.phone || '+1 234 567 890';
  const place = 'India';

  const children: any[] = [];

  // Header
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: "Xebia",
          bold: true,
          size: 56, // Half-points (28pt)
          color: "6e2b62"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: name.toUpperCase(), bold: true, size: 28 }) // 14pt
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: role.toUpperCase(), bold: true, size: 24 }) // 12pt
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: `${place} | ${phone} | ${email}`, size: 20 }) // 10pt
      ]
    })
  );

  const addSectionHeader = (title: string) => {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NIL },
          bottom: { style: BorderStyle.NIL },
          left: { style: BorderStyle.NIL },
          right: { style: BorderStyle.NIL },
          insideHorizontal: { style: BorderStyle.NIL },
          insideVertical: { style: BorderStyle.NIL }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: "e6e6e6" },
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: title, bold: true, size: 22 })]
                  })
                ]
              })
            ]
          })
        ]
      }),
      new Paragraph({ spacing: { before: 100, after: 100 } })
    );
  };

  // Summary
  addSectionHeader('SUMMARY');
  let rawBullets = summary.split('\n').filter((s: string) => s.trim().length > 0);
  if (rawBullets.length < 2) {
    rawBullets = summary.split('.').filter((s: string) => s.trim().length > 0).map((s: string) => s.trim() + '.');
  }
  const summaryBullets = rawBullets
    .map((s: string) => s.trim().replace(/^[-*•]\s*/, ''))
    .filter((s: string) => s.length > 0);
  
  summaryBullets.forEach((bullet: string) => {
    children.push(
      new Paragraph({
        text: bullet,
        bullet: { level: 0 },
        style: "Normal",
        spacing: { before: 120, after: 120 }
      })
    );
  });
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // Certifications
  if (certs.length > 0) {
    addSectionHeader('CERTIFICATIONS');
    certs.forEach((cert: string) => {
      children.push(
        new Paragraph({
          text: cert,
          bullet: { level: 0 },
          style: "Normal",
          spacing: { before: 120, after: 120 }
        })
      );
    });
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Technical Skills
  if (skillsGrouped && skillsGrouped.length > 0) {
    addSectionHeader('TECHNICAL SKILLS');
    
    const rows = skillsGrouped.map((group: any) => {
      return new TableRow({
        children: [
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: group.category, bold: true, size: 20 })] })]
          }),
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: Array.isArray(group.items) ? group.items.join(', ') : '', size: 20 })] })]
          })
        ]
      });
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 7000],
        rows: rows
      }),
      new Paragraph({ spacing: { after: 300 } })
    );
  }

  // Projects
  if (projects.length > 0) {
    addSectionHeader('PROJECT SUMMARY');
    
    projects.forEach((proj: any) => {
      const projRows = [];
      
      projRows.push(
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: "dbeafe" },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: `Organization: ${proj.organization || 'N/A'}`, bold: true, size: 20 })] })]
            }),
            new TableCell({
              shading: { fill: "dbeafe" },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: `Job Title: ${proj.jobTitle || 'N/A'}`, bold: true, size: 20 })] })]
            })
          ]
        })
      );

      projRows.push(
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: `Domain: ${proj.domain || 'N/A'}`, bold: true, size: 20 })] })]
            }),
            new TableCell({
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: proj.dates || '', size: 20 })] })]
            })
          ]
        })
      );

      if (proj.toolsAndTech && proj.toolsAndTech.length > 0) {
        projRows.push(
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Tools & Technologies: ", bold: true, size: 20 }),
                      new TextRun({ text: proj.toolsAndTech.join(', '), size: 20 })
                    ]
                  })
                ]
              })
            ]
          })
        );
      }

      if (proj.responsibilities && proj.responsibilities.length > 0) {
        const resBullets = proj.responsibilities.map((r: string) => r.trim()).filter((r: string) => r.length > 0);
        const cellChildren: any[] = [
          new Paragraph({ children: [new TextRun({ text: "Responsibilities:", bold: true, size: 20 })] })
        ];
        
        resBullets.forEach((bullet: string) => {
          cellChildren.push(
            new Paragraph({
              text: bullet,
              bullet: { level: 0 },
              style: "Normal",
              spacing: { before: 120, after: 120 }
            })
          );
        });

        projRows.push(
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                children: cellChildren
              })
            ]
          })
        );
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [5000, 5000],
          rows: projRows
        }),
        new Paragraph({ spacing: { after: 300 } })
      );
    });
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            size: 20, // 10pt
            font: "Arial",
          }
        }
      }
    },
    sections: [
      {
        properties: {},
        children: children
      }
    ]
  });

  return await Packer.toBuffer(doc);
}
