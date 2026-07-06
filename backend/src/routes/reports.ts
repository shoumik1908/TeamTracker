import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const router = Router();
const prisma = new PrismaClient();

type ExportFormat = 'json' | 'csv' | 'excel' | 'pdf';

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

// GET /api/reports/team
router.get('/team', async (req: Request, res: Response) => {
  const format = (req.query.format as ExportFormat) || 'json';
  const members = await prisma.teamMember.findMany({
    include: {
      _count: { select: { assignedCertifications: true, projectMembers: true } },
      assignedCertifications: { where: { status: 'COMPLETED' }, select: { id: true } },
    },
    orderBy: { name: 'asc' },
  });

  const rows = members.map(m => [
    m.name, m.phone || '', m.designation || '',
    m.joiningDate.toLocaleDateString(),
    m.skills.join(', '),
    String(m._count.projectMembers),
    String(m._count.assignedCertifications),
    String(m.assignedCertifications.length),
  ]);
  const headers = ['Name', 'Phone', 'Designation', 'Joining Date', 'Skills', 'Projects', 'Total Certs', 'Completed Certs'];

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="team-report.csv"');
    return res.send(toCSV(headers, rows));
  }

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Team Report');
    sheet.addRow(headers);
    rows.forEach(r => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach(col => { col.width = 20; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="team-report.xlsx"');
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Team Report', 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 24);
    autoTable(doc, { head: [headers], body: rows, startY: 30, styles: { fontSize: 8 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="team-report.pdf"');
    return res.send(Buffer.from(doc.output('arraybuffer')));
  }

  res.json(members);
});

// GET /api/reports/certifications
router.get('/certifications', async (req: Request, res: Response) => {
  const format = (req.query.format as ExportFormat) || 'json';
  const assignments = await prisma.assignedCertification.findMany({
    include: {
      member: { select: { name: true } },
      certification: { select: { name: true, provider: true } },
    },
    orderBy: { deadline: 'asc' },
  });

  const headers = ['Member', 'Certification', 'Provider', 'Assigned Date', 'Deadline', 'Progress', 'Status', 'Priority'];
  const rows = assignments.map(a => [
    a.member.name,
    a.certification.name, a.certification.provider,
    a.assignedDate.toLocaleDateString(),
    a.deadline.toLocaleDateString(),
    `${a.progress}%`,
    a.status.replace(/_/g, ' '),
    a.priority,
  ]);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="certifications-report.csv"');
    return res.send(toCSV(headers, rows));
  }

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Certifications');
    sheet.addRow(headers);
    rows.forEach(r => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach(col => { col.width = 20; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="certifications-report.xlsx"');
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Certifications Report', 14, 16);
    autoTable(doc, { head: [headers], body: rows, startY: 30, styles: { fontSize: 8 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="certifications-report.pdf"');
    return res.send(Buffer.from(doc.output('arraybuffer')));
  }

  res.json(assignments);
});

// GET /api/reports/projects
router.get('/projects', async (req: Request, res: Response) => {
  const format = (req.query.format as ExportFormat) || 'json';
  const projects = await prisma.project.findMany({
    include: {
      manager: { select: { name: true } },
      _count: { select: { members: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  const headers = ['Name', 'Client', 'Manager', 'Start Date', 'End Date', 'Status', 'Priority', 'Progress', 'Members'];
  const rows = projects.map(p => [
    p.name, p.client || '', p.manager?.name || 'N/A', p.startDate.toLocaleDateString(),
    p.endDate?.toLocaleDateString() || 'N/A',
    p.status.replace(/_/g, ' '), p.priority, `${p.progress}%`,
    String(p._count.members),
  ]);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="projects-report.csv"');
    return res.send(toCSV(headers, rows));
  }

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Projects');
    sheet.addRow(headers);
    rows.forEach(r => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach(col => { col.width = 18; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="projects-report.xlsx"');
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Projects Report', 14, 16);
    autoTable(doc, { head: [headers], body: rows, startY: 30, styles: { fontSize: 9 } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="projects-report.pdf"');
    return res.send(Buffer.from(doc.output('arraybuffer')));
  }

  res.json(projects);
});

// GET /api/reports/deadlines
router.get('/deadlines', async (req: Request, res: Response) => {
  const format = (req.query.format as ExportFormat) || 'json';
  const now = new Date();

  const deadlines = await prisma.assignedCertification.findMany({
    where: { status: { not: 'COMPLETED' } },
    include: {
      member: { select: { name: true } },
      certification: { select: { name: true, provider: true } },
    },
    orderBy: { deadline: 'asc' },
  });

  const categorized = deadlines.map(d => ({
    ...d,
    category: d.deadline < now ? 'Overdue'
      : d.deadline.toDateString() === now.toDateString() ? 'Due Today'
        : d.deadline <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) ? 'Due This Week'
          : 'Upcoming',
  }));

  const headers = ['Member', 'Certification', 'Provider', 'Deadline', 'Status', 'Progress', 'Category'];
  const rows = categorized.map(d => [
    d.member.name,
    d.certification.name, d.certification.provider,
    d.deadline.toLocaleDateString(),
    d.status.replace(/_/g, ' '), `${d.progress}%`, d.category,
  ]);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="deadlines-report.csv"');
    return res.send(toCSV(headers, rows));
  }

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Deadlines');
    sheet.addRow(headers);
    rows.forEach(r => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach(col => { col.width = 20; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="deadlines-report.xlsx"');
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  }

  res.json(categorized);
});

export default router;
