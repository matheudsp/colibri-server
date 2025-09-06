/**
 * Define os contextos para ações críticas que exigem verificação por OTP.
 */
export const VerificationContexts = {
  PIX_KEY_UPDATE: 'PIX_KEY_UPDATE',
  DELETE_PROPERTY: 'DELETE_PROPERTY',
  CANCEL_CONTRACT: 'CANCEL_CONTRACT',
  LOGIN_2FA: 'LOGIN_2FA',
  DISABLE_2FA: 'DISABLE_2FA',
} as const;

export type VerificationContext =
  (typeof VerificationContexts)[keyof typeof VerificationContexts];
