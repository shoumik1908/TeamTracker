import prisma from '../lib/prisma';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from './errorHandler';
import { requestContext } from '../lib/context';
import { JWT_SECRET } from '../lib/jwtSecret';

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

    // TT-027: permissions used to be taken from the token, so a role change or a
    // revoked permission did not take effect until the token expired — up to 24
    // hours. This lookup already existed for the isActive check; it now also loads
    // the role, and the request is authorized from the database rather than from a
    // claim the holder could be carrying from before the change.
    const userInDb = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { isActive: true, roleId: true, teamMemberId: true, role: { select: { permissions: true } } },
    });

    if (!userInDb || !userInDb.isActive) {
      return next(new AppError('User account is deactivated or not found', 401));
    }

    const user = {
      ...decoded,
      roleId: userInDb.roleId,
      teamMemberId: userInDb.teamMemberId,
      permissions: userInDb.role?.permissions ?? {},
    };
    req.user = user;

    requestContext.run({ user }, () => {
      next();
    });
  } catch (error) {
    // TT-098: an expired or malformed token is an authentication failure, not an
    // authorization one. 403 is reserved for "you are known but not allowed".
    return next(new AppError('Invalid or expired token', 401));
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
