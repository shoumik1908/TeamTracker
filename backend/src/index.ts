import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
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
import { errorHandler } from './middleware/errorHandler';
import { initLogCleanupJob } from './jobs/logCleanup';
import { initMeetingMinutesRetryJob } from './jobs/meetingMinutesRetry';

const app = express();

// Initialize scheduled jobs
initLogCleanupJob();
initMeetingMinutesRetryJob();

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
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
app.use('/api/presales/:opportunityId/documentation', documentationRouter);
app.use('/api/presales/:opportunityId/meeting-records', meetingRecordsRouter);
app.use('/api', teamsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
