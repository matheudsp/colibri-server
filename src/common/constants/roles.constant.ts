import { UserRole } from '@prisma/client';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['*'],
  [UserRole.LOCADOR]: [
    'properties:own:create',
    'properties:own:manage',
    'contracts:own:view',
  ],
  [UserRole.LOCATARIO]: [
    'contracts:own:view',
    'profile:own:manage',
    'documents:own:upload',
  ],
};

export const ROLES = {
  ADMIN: UserRole.ADMIN,
  LOCADOR: UserRole.LOCADOR,
  LOCATARIO: UserRole.LOCATARIO,
} as const;
