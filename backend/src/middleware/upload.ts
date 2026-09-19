import multer from 'multer';
import { AppError } from './errorHandler';

// A rejected file is the caller's mistake. These filters used to call cb(new Error(...)),
// a plain Error that is neither an AppError nor a MulterError, so it slipped past the
// mapping added in #45 and surfaced as a 500 carrying a perfectly good 400 message —
// "Only JPEG and PNG images are allowed", with HTTP 500. Found while verifying the
// multer 2.x upgrade (TT-017).

// Use memory storage so we can upload directly to Azure Blob
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, and PDF files are allowed', 400));
    }
  },
});

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG and PNG images are allowed', 400));
    }
  },
});

// TT-100: uploadAny accepted any file type at all, up to 50MB, with no filter. It
// backs CoE resources, learning-project assets, session transcripts, meeting notes
// and task feedback.
//
// Filtering on extension rather than file.mimetype, deliberately: the CoE resources
// picker offers .ipynb and .zip, and browsers commonly send those as
// application/octet-stream or application/json, so a MIME allow-list would reject
// files the product explicitly invites. Neither signal is trustworthy — both come
// from the client — so extension is chosen for predictability, not security.
//
// What actually contains the risk: the size cap below, that uploads are never
// executed or extracted server-side, and that blobs are served with their stored
// content type. Verifying magic bytes would be the next step up.
const ALLOWED_UPLOAD_EXTENSIONS = [
  // documents — matches the CoE picker: .pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.ipynb,.zip
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv', 'md', 'ipynb', 'zip',
  // images, for task feedback attachments
  'png', 'jpg', 'jpeg', 'gif', 'webp',
];

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

export const uploadAny = multer({
  storage: multer.memoryStorage(),
  // Lowered from 50MB. These are documents and images, and memoryStorage holds every
  // concurrent upload in the process, so this is a memory guard as much as a policy.
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    if (ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      // AppError, not Error: a plain Error is indistinguishable from a genuine
      // fault and became a 500 with its message stripped in production.
      cb(new AppError(`Unsupported file type ".${ext || 'unknown'}". Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`, 400));
    }
  },
});
