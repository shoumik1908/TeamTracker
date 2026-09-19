import prisma from '../lib/prisma';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { parsePagination } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';


const router = Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  const user = (req as AuthRequest).user;
  if (!user?.permissions?.manageTeam) throw new AppError('Forbidden: Only Admins can view logs', 403);

  const { search = '', category = 'All', dateRange = 'all' } = req.query;

  // TT-109: `|| 1` and `|| 50` caught NaN but not a negative page — which becomes a
  // negative skip and a Prisma error — and nothing capped the limit, so one request
  // could ask for the entire activity log.
  const { page: pageNum, limit: limitNum } = parsePagination(req.query, { limit: 50, maxLimit: 200 });

  let whereClause: any = {};

  if (category && category !== 'All') {
    whereClause.category = category;
  }

  if (search) {
    whereClause.OR = [
      { details: { contains: search as string, mode: 'insensitive' } },
      { action: { contains: search as string, mode: 'insensitive' } },
      { category: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    if (dateRange === 'today') {
      const today = new Date(now.setHours(0,0,0,0));
      whereClause.createdAt = { gte: today };
    } else if (dateRange === 'week') {
      const lastWeek = new Date(now.setDate(now.getDate() - 7));
      whereClause.createdAt = { gte: lastWeek };
    } else if (dateRange === 'month') {
      const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
      whereClause.createdAt = { gte: lastMonth };
    }
  }

  const logs = await prisma.activityLog.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  });

  const total = await prisma.activityLog.count({ where: whereClause });

  res.json({
    data: logs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

export default router;
