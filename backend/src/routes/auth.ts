import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-do-not-use-in-prod';

// Helper to generate token
const generateToken = (user: any, role: any) => {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      teamMemberId: user.teamMemberId,
      mustChangePassword: user.mustChangePassword,
      permissions: role.permissions
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already in use', 400);
    }

    // Check if team member exists in roster by name
    // Match case-insensitive
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' }
      }
    });

    if (teamMembers.length === 0) {
      throw new AppError('Name not found in team roster — contact your admin.', 403);
    }

    // Map to the first matched team member
    const teamMember = teamMembers[0];

    // Check if this team member already has a mapped user
    const existingMapping = await prisma.user.findUnique({ where: { teamMemberId: teamMember.id } });
    if (existingMapping) {
      throw new AppError('This team member profile is already mapped to an existing account.', 400);
    }

    // Get "Team Member" role
    const memberRole = await prisma.role.findUnique({ where: { name: 'Team Member' } });
    if (!memberRole) {
      throw new AppError('Default role not found. Please contact admin.', 500);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        passwordHash,
        roleId: memberRole.id,
        teamMemberId: teamMember.id,
        mustChangePassword: false, // User created their own password
        isActive: true
      },
      include: { role: true }
    });

    const token = generateToken(user, user.role);

    // Notify admins
    await prisma.notification.create({
      data: {
        targetRole: 'Admin',
        type: 'NEW_MEMBER_REGISTERED',
        title: 'New User Registered',
        message: `${name} has just registered and mapped to their team profile.`,
      },
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        teamMemberId: user.teamMemberId,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
      include: { role: true }
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Contact admin.', 403);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = generateToken(user, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        teamMemberId: user.teamMemberId,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current and new passwords are required', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new AppError('User not found', 404);

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid current password', 401);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
      include: { role: true }
    });

    // Re-issue token so mustChangePassword is false
    const token = generateToken(updatedUser, updatedUser.role);

    res.json({ message: 'Password updated successfully', token, user: { ...updatedUser, passwordHash: undefined } });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { role: true, teamMember: true }
    });
    if (!user) throw new AppError('User not found', 404);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        teamMemberId: user.teamMemberId,
        role: user.role,
        teamMember: user.teamMember
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
