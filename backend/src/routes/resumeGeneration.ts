import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { tailorResumeForJD, extractCvWithAI } from '../services/aiExtractor';
import { uploadFile, CONTAINERS, sanitizeDirectoryName } from '../services/blobStorage';
import multer from 'multer';

// Multer config for JD uploads (PDF + DOCX, in-memory, 10 MB limit)
const dualUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are accepted'));
    }
  },
});

const jdUpload = dualUpload.single('jdFile');
const adHocUpload = dualUpload.fields([
  { name: 'cvFile', maxCount: 1 },
  { name: 'jdFile', maxCount: 1 }
]);

const router = Router();
const prisma = new PrismaClient();

async function getMemberCertifications(memberId: string): Promise<string[]> {
  const assignments = await prisma.assignedCertification.findMany({
    where: { memberId, status: 'COMPLETED' },
    include: { certification: true }
  });
  return assignments.map(a => a.certification.name);
}

import { createCvDocx } from '../services/docxGenerator';

router.use(authenticateToken);

// Helper function to generate DOCX and upload to Blob Storage
async function generateAndUploadDocx(docBuffer: Buffer, fileName: string, memberId: string, memberName: string): Promise<string> {
  // Upload to Blob Storage
  const sanitizedName = sanitizeDirectoryName(memberName);
  const folderName = `${memberId}-${sanitizedName}`;
  
  const { url } = await uploadFile(
    CONTAINERS.CVS,
    docBuffer,
    `generated/${folderName}/${fileName}`,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  return url;
}



// POST /api/resume-generation/:id/generate
router.post('/:id/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    let profile: any = await prisma.resumeProfile.findFirst({
      where: { memberId: id },
      orderBy: { uploadedAt: 'desc' },
      include: { member: true }
    });

    if (!profile) {
      const member = await prisma.teamMember.findUnique({ where: { id } });
      if (member && member.cvBlobUrl) {
        profile = {
          member,
          summary: member.cvSummary,
          skills: member.skillsExtracted,
          primaryRole: member.designation,
        } as any;
      } else {
        throw new AppError('No resume profile found for this member', 404);
      }
    }

    const dbCerts = await getMemberCertifications(id);
    profile.certifications = Array.from(new Set([...(profile.certifications || []), ...dbCerts]));

    const docBuffer = await createCvDocx(profile);
    const sanitizedRole = (profile.primaryRole || 'Data_Engineer').replace(/\s+/g, '_');
    const fileName = `${profile.member.name.replace(/\s+/g, '_')}_${sanitizedRole}_CV.docx`;
    
    const pdfUrl = await generateAndUploadDocx(docBuffer, fileName, id, profile.member.name);

    const generatedResume = await prisma.generatedResume.create({
      data: {
        memberId: id,
        tailoredContent: {
          summary: profile.summary,
          skills: profile.skills
        },
        pdfUrl
      }
    });

    res.json(generatedResume);
  } catch (error) {
    next(error);
  }
});

// POST /api/resume-generation/:id/generate-tailored
router.post('/:id/generate-tailored', jdUpload, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let { jobDescription } = req.body;
    
    // Process uploaded file if provided
    if (req.file) {
      let extractedText = '';
      const mimeType = req.file.mimetype;
      if (mimeType === 'application/pdf') {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: req.file.buffer });
        try {
          const result = await parser.getText();
          extractedText = result.text;
        } finally {
          if (typeof parser.destroy === 'function') await parser.destroy();
        }
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        extractedText = result.value;
      }
      
      jobDescription = jobDescription 
        ? `${extractedText}\n\nAdditional Notes:\n${jobDescription}` 
        : extractedText;
    }
    
    if (!jobDescription || !jobDescription.trim()) {
      throw new AppError('Job description (either text or file) is required', 400);
    }

    let profile: any = await prisma.resumeProfile.findFirst({
      where: { memberId: id },
      orderBy: { uploadedAt: 'desc' },
      include: { member: true }
    });

    if (!profile) {
      const member = await prisma.teamMember.findUnique({ where: { id } });
      if (member && member.cvBlobUrl) {
        profile = {
          member,
          summary: member.cvSummary,
          skills: member.skillsExtracted,
          primaryRole: member.designation,
        } as any;
      } else {
        throw new AppError('No resume profile found for this member', 404);
      }
    }

    // 1. Tailor the content via LLM
    const tailored = await tailorResumeForJD(profile, jobDescription);

    // 2. Generate PDF using tailored content
    // pdfmake mutates the arrays passed to it, so we clone the tailored object
    const tailoredClone = JSON.parse(JSON.stringify(tailored));
    
    // Override tailored certs with actual DB/profile certs to ensure no hallucination
    const dbCerts = await getMemberCertifications(id);
    const allCerts = Array.from(new Set([...(profile.certifications || []), ...dbCerts]));
    
    const docBuffer = await createCvDocx(
      profile, 
      tailoredClone.summary, 
      tailoredClone.skills, 
      tailoredClone.projects, 
      tailoredClone.skillsGrouped, 
      allCerts
    );
    const sanitizedRole = (profile.primaryRole || 'Data_Engineer').replace(/\s+/g, '_');
    const fileName = `${profile.member.name.replace(/\s+/g, '_')}_${sanitizedRole}_Tailored_CV.docx`;
    
    const pdfUrl = await generateAndUploadDocx(docBuffer, fileName, id, profile.member.name);

    const generatedResume = await prisma.generatedResume.create({
      data: {
        memberId: id,
        jobDescription,
        tailoredContent: tailored as any,
        pdfUrl
      }
    });

    res.json(generatedResume);
  } catch (error) {
    next(error);
  }
});

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  let extractedText = '';
  const mimeType = file.mimetype;
  if (mimeType === 'application/pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      extractedText = result.text;
    } finally {
      if (typeof parser.destroy === 'function') await parser.destroy();
    }
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    extractedText = result.value;
  }
  return extractedText;
}

// POST /api/resume-generation/generate-tailored-from-file
router.post('/generate-tailored-from-file', adHocUpload, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { jobDescription } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files || !files.cvFile || files.cvFile.length === 0) {
      throw new AppError('CV file is required', 400);
    }
    
    const cvFile = files.cvFile[0];
    const cvText = await extractTextFromFile(cvFile);
    
    if (files.jdFile && files.jdFile.length > 0) {
      const jdText = await extractTextFromFile(files.jdFile[0]);
      jobDescription = jobDescription 
        ? `${jdText}\n\nAdditional Notes:\n${jobDescription}` 
        : jdText;
    }
    
    if (!jobDescription || !jobDescription.trim()) {
      throw new AppError('Job description (either text or file) is required', 400);
    }

    // Extract profile from CV
    const extractedCv = await extractCvWithAI(cvText);
    
    const profile = {
      member: { name: 'Applicant' },
      summary: extractedCv.summary,
      skills: extractedCv.skills,
      skillsGrouped: extractedCv.skillsGrouped,
      projects: extractedCv.projects,
      primaryRole: extractedCv.primary_role,
      yearsOfExperience: extractedCv.years_of_experience,
      certifications: extractedCv.certifications_mentioned || []
    };

    // Tailor the content via LLM
    const tailored = await tailorResumeForJD(profile, jobDescription);
    const tailoredClone = JSON.parse(JSON.stringify(tailored));
    
    const docBuffer = await createCvDocx(
      profile, 
      tailoredClone.summary, 
      tailoredClone.skills, 
      tailoredClone.projects, 
      tailoredClone.skillsGrouped, 
      profile.certifications
    );
    
    const sanitizedRole = (profile.primaryRole || 'Data_Engineer').replace(/\s+/g, '_');
    const fileName = `Applicant_${sanitizedRole}_Tailored_CV.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(docBuffer);
    
  } catch (error) {
    next(error);
  }
});

export default router;
