export enum EmailJobType {
  RECOVERY_PASSWORD = 'recovery-password',
  NOTIFICATION = 'notification',
  NEW_ACCOUNT = 'new-account',
  EMAIL_VERIFICATION = 'email-verification',
  OTP_VERIFICATION = 'otp-verification',
}

export interface RecoveryPasswordJob {
  email: string;
  name: string;
  token: string;
  expiresIn: number;
}
export interface OtpVerificationJob {
  user: {
    email: string;
    name: string;
  };
  otpCode: string;
}
export interface NotificationAction {
  text: string;
  path?: string;
  url?: string;
}
export interface NotificationJob {
  user: {
    email: string;
    name: string;
  };
  notification: {
    title: string;
    message: string;
  };
  action?: NotificationAction;
}

export interface NewAccountJob {
  user: {
    email: string;
    name: string;
  };
  temporaryPassword?: string;
}
export interface EmailVerificationJob {
  email: string;
  name: string;
  token: string;
}
