import { UserRole } from '@prisma/client';

export enum SignatureJobType {
  INITIATE_SIGNATURE_PROCESS = 'initiate-signature-process',
}

export interface InitiateSignatureProcessJob {
  contractId: string;
  userId: string;
  userRole: UserRole;
  userEmail: string;
  userIsActive: boolean;
}
