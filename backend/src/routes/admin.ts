import prisma from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest, requirePermission } from '../middleware/auth';

const router = Router();

// Ensure all routes in this file require 'manageTeam' permission
router.use(authenticateToken);
router.use(requirePermission('manageTeam'));

// GET /api/admin/users
router.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: true,
        teamMember: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Remove passwordHash from response
    const safeUsers = users.map(u => {
      const { passwordHash, ...rest } = u;
      return rest;
    });

    res.json(safeUsers);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/roles
router.get('/roles', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany();
    res.json(roles);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:userId/role
router.patch('/users/:userId/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roleId } = req.body;
    const { userId } = req.params;

    if (!roleId) throw new AppError('Role ID is required', 400);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true }
    });

    res.json({ message: 'Role updated successfully', user: { id: updatedUser.id, role: updatedUser.role } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:userId/status
router.patch('/users/:userId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = req.body;
    const { userId } = req.params;

    if (typeof isActive !== 'boolean') throw new AppError('isActive boolean is required', 400);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    });

    res.json({ message: 'User status updated', user: { id: updatedUser.id, isActive: updatedUser.isActive } });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users/:userId/reset-password
router.post('/users/:userId/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    // Reset password to firstname+xebia
    const firstName = user.name.split(' ')[0].toLowerCase();
    const newPwd = `${firstName}+xebia`;
    const passwordHash = await bcrypt.hash(newPwd, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true }
    });

    res.json({ message: 'Password reset to default (firstname+xebia)' });
  } catch (error) {
    next(error);
  }
});

export default router;
