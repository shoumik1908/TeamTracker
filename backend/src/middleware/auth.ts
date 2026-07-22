import prisma from '../lib/prisma';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from './errorHandler';
import { requestContext } from '../lib/context';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-do-not-use-in-prod';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    roleId: string;
    teamMemberId: string | null;
    mustChangePassword: boolean;
    permissions: any;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new AppError('No auth token provided', 401));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;

    // Optional: Double check if user is still active in DB
    const userInDb = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { isActive: true }
    });

    if (!userInDb || !userInDb.isActive) {
      return next(new AppError('User account is deactivated or not found', 401));
    }

    requestContext.run({ user: decoded }, () => {
      next();
    });
  } catch (error) {
    return next(new AppError('Invalid or expired token', 403));
  }
};

export const requirePermission = (action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401));
    }

    const permissions = req.user.permissions;
    if (permissions && permissions[action] === true) {
      return next();
    }

    return next(new AppError(`Forbidden: Missing ${action} permission`, 403));
  };
};
