import type { JwtPayload } from './jwt.payload.interface';

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: JwtPayload;
}
