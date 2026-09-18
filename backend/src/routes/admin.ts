import prisma from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest, requirePermission } from '../middleware/auth';

const router = Router();

const grantsAdmin = (permissions: any) => permissions?.manageTeam === true;

/**
 * Refuse a change that would leave the estate with nobody who can administer it.
 * TT-101 asks for this on role assignment; deactivation reaches the same end state,
 * and a demo showed it going all the way to zero active admins.
 */
async function assertNotLastAdmin(userId: string) {
  const adminRoleIds = (await prisma.role.findMany())
    .filter(r => grantsAdmin(r.permissions))
    .map(r => r.id);
  const remaining = await prisma.user.count({
    where: { isActive: true, roleId: { in: adminRoleIds }, id: { not: userId } },
  });
  if (remaining === 0) {
    throw new AppError('This is the last active administrator — promote or activate someone else first.', 400);
  }
}

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

    // TT-101: any roleId was accepted, an admin could demote themselves, and nothing
    // stopped the last administrator being removed — leaving an estate nobody can
    // administer.
    const [targetRole, targetUser] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleId } }),
      prisma.user.findUnique({ where: { id: userId }, include: { role: true } }),
    ]);
    if (!targetRole) throw new AppError('Unknown role', 400);
    if (!targetUser) throw new AppError('User not found', 404);

    const caller = (req as AuthRequest).user;
    if (caller?.id === userId) {
      throw new AppError('You cannot change your own role. Ask another administrator.', 400);
    }

    if (grantsAdmin(targetUser.role?.permissions) && !grantsAdmin(targetRole.permissions)) {
      await assertNotLastAdmin(userId);
    }

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

    // Deactivating an administrator removes their access just as surely as demoting
    // them, so the same invariant applies. Verified before this guard existed: the
    // last admin could deactivate themselves, leaving zero active administrators.
    if (!isActive) {
      const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
      if (!target) throw new AppError('User not found', 404);
      if (grantsAdmin(target.role?.permissions)) await assertNotLastAdmin(userId);
    }

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

    // TT-028: the reset password used to be `firstname+xebia`, so knowing anyone's
    // name was enough to take their account after a reset — and the scheme is the
    // same for every user. Now a one-time random value.
    const newPwd = crypto.randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(newPwd, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true }
    });

    // Returned once, to the admin who just performed the reset, so they can pass it
    // on — there is no email delivery in this system. It is single-use in practice:
    // mustChangePassword forces a change at next sign-in.
    res.json({
      message: 'Password reset. Share this one-time password with the user; they must change it at next sign-in.',
      temporaryPassword: newPwd,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
