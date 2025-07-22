export enum EmailJobType {
  RECOVERY_PASSWORD = 'recovery-password',
  NOTIFICATION = 'notification',
  NEW_ACCOUNT = 'new-account',
}

export interface RecoveryPasswordJob {
  email: string;
  name: string;
  token: string;
  expiresIn: number;
}

export interface NotificationAction {
  text: string;
  path: string;
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
  temporaryPassword?: string
}
