import prisma from '../lib/prisma';
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { JWT_SECRET } from '../lib/jwtSecret';

const router = Router();

// TT-102: neither register nor change-password checked password strength at all.
const MIN_PASSWORD_LENGTH = 10;
function assertPasswordAcceptable(password: string) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError('Password must contain at least one letter and one number.', 400);
  }
}

// TT-103: emails were stored and compared as typed, so Alice@x and alice@x could
// both register and then fail to log in depending on capitalisation.
const normalizeEmail = (email: string) => email.trim().toLowerCase();

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
    const { name, password } = req.body;
    const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';
    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400);
    }
    assertPasswordAcceptable(password);

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

    // TT-029: matching on name alone let anyone register as a colleague simply by
    // typing their name. Where the roster row carries an email, it must be the one
    // being registered. Rows without an email fall back to the previous behaviour
    // rather than locking those people out — TeamMember.email is nullable and many
    // rows have none.
    const withEmail = teamMembers.filter(m => m.email);
    if (withEmail.length > 0) {
      const matched = withEmail.find(m => normalizeEmail(m.email as string) === email);
      if (!matched) {
        throw new AppError(
          'That name is on the roster but the email does not match the one on file — contact your admin.',
          403,
        );
      }
    }

    // Map to the matched roster row, preferring the email match when there was one
    const teamMember = teamMembers.find(m => m.email && normalizeEmail(m.email) === email) ?? teamMembers[0];

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
        email,
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
    const { password } = req.body;
    const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Case-insensitive rather than a normalized exact match: accounts created before
    // normalization may hold a mixed-case address, and an exact lookup would lock
    // those people out of their own accounts.
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
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
    assertPasswordAcceptable(newPassword);

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
