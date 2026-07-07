import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

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
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/members', membersRouter);
app.use('/api/certifications', certificationsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/search', searchRouter);
app.use('/api/chat', chatRouter);
app.use('/api/project-updates', projectUpdatesRouter);
app.use('/api/reports', reportsRouter);
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
