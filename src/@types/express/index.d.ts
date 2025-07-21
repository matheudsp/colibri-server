import { UserRole } from '@prisma/client';

type UserFromRequest = {
  sub: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

declare global {
  namespace Express {
    interface Request {
      user?: UserFromRequest;
    }
  }
}
