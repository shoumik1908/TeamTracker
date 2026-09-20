import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { validateAiConfig } from './services/aiProvider';

// Validate AI environment configuration
validateAiConfig();

import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import membersRouter from './routes/members';
import certificationsRouter from './routes/certifications';
import projectsRouter from './routes/projects';
import dashboardRouter from './routes/dashboard';
import notificationsRouter from './routes/notifications';
import searchRouter from './routes/search';
import reportsRouter from './routes/reports';
import chatRouter from './routes/chat';
import projectUpdatesRouter from './routes/projectUpdates';
import teamsRouter from './routes/teams';
import presalesRouter from './routes/presales';
import gtmRouter from './routes/gtm';
import documentationRouter from './routes/documentation';
import filesRouter from './routes/files';
import logsRouter from './routes/logs';
import meetingRecordsRouter from './routes/meetingRecords';
import meetingReportRouter from './routes/meetingReport';
import taskRoutes from './routes/taskRoutes';
import resumeGenerationRouter from './routes/resumeGeneration';
import taskFeedbackRouter from './routes/taskFeedback';
import coeRouter from './routes/coe';
import { errorHandler } from './middleware/errorHandler';
import { initLogCleanupJob } from './jobs/logCleanup';
import { initMeetingMinutesRetryJob } from './jobs/meetingMinutesRetry';
import { initCoeSessionReminderJob } from './jobs/coeSessionReminders';

const app = express();
// Initialize scheduled jobs
initLogCleanupJob();
initMeetingMinutesRetryJob();
initCoeSessionReminderJob();

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';









// Middleware
// TT-095: 'http://localhost:5174' was allowed unconditionally, in production too. A
// permanently trusted localhost origin lets anything running on a viewer's own machine
// — another dev server, a malicious local app — make credentialed calls to the
// production API. Local origins are for local runs only.
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const allowedOrigins = isProduction
  ? [FRONTEND_URL]
  : [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'];

// TT-069: the session cookie only travels if the browser is told to send credentials,
// and the server must say it accepts them.
app.use(cookieParser());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  // Content-Disposition is not a CORS-safelisted response header, so without this the
  // browser hides it from JavaScript on a cross-origin call — which is every call in the
  // deployed setup, with the frontend on Vercel and the API on Render. The download
  // handlers read it to name the saved file; unexposed, headers.get() returns null and
  // every download falls back to its hardcoded default name. The header is already sent.
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TT-022: /api/auth/login and /api/auth/register had no rate limiting, so both were
// open to unlimited credential stuffing. The store is in-memory, which means the
// limit is per instance — correct on a single Render instance, and worth revisiting
// behind a shared store if this is ever scaled out.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/change-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/members', membersRouter);
app.use('/api/certifications', certificationsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/search', searchRouter);
app.use('/api/chat', chatRouter);
app.use('/api/project-updates', projectUpdatesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/presales', presalesRouter);
app.use('/api/gtm', gtmRouter);
app.use('/api/files', filesRouter);
app.use('/api/logs', logsRouter);
app.use('/api/projects/:projectId/documentation', documentationRouter);
app.use('/api/projects/:projectId/meeting-records', meetingRecordsRouter);
app.use('/api/projects/:projectId/meeting-report', meetingReportRouter);
app.use('/api/tasks', taskRoutes);
app.use('/api/resume-generation', resumeGenerationRouter);
app.use('/api/tasks/:id/feedback', taskFeedbackRouter);
app.use('/api/coe', coeRouter);
app.use('/api/presales/:opportunityId/documentation', documentationRouter);
app.use('/api/presales/:opportunityId/meeting-records', meetingRecordsRouter);
app.use('/api', teamsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// TT-163: an unhandled rejection or an uncaught exception left the process in an
// unknown state — Node's default is to print and, for rejections, eventually exit — with
// nothing logged that would explain it afterwards. And a failed listen (EADDRINUSE) was
// silent: the process stayed alive having bound nothing, which is exactly how a test run
// earlier in this work ended up talking to a different server than it believed.
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  // The process state is no longer trustworthy after this; let the platform restart it.
  process.exit(1);
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

  // Ponytail: Minimal self-ping to prevent Render sleep. 
  // No external dependencies, just built-in fetch on a timer.
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    console.log(`⏱️ Self-ping enabled for ${renderUrl}/health every 10m`);
    setInterval(() => {
      fetch(`${renderUrl}/health`)
        .then(res => console.log(`[Self-Ping] OK - Status: ${res.status}`))
        .catch(err => console.error(`[Self-Ping] Error: ${err.message}`));
    }, 10 * 60 * 1000); // 10 minutes
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} is already in use — refusing to start.`);
  } else {
    console.error('[FATAL] Server failed to start:', err);
  }
  process.exit(1);
});

export default app;
