/**
 * Define os contextos para ações críticas que exigem verificação por OTP.
 */
export const VerificationContexts = {
  CREATE_BANK_ACCOUNT: 'CREATE_BANK_ACCOUNT',
  PIX_KEY_UPDATE: 'PIX_KEY_UPDATE',
  DELETE_PROPERTY: 'DELETE_PROPERTY',
  CANCEL_CONTRACT: 'CANCEL_CONTRACT',
  LOGIN_2FA: 'LOGIN_2FA',
  DISABLE_2FA: 'DISABLE_2FA',
  UPDATE_USER_PROFILE: 'UPDATE_USER_PROFILE',
} as const;

export type VerificationContext =
  (typeof VerificationContexts)[keyof typeof VerificationContexts];
