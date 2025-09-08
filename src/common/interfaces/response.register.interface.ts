import { JwtPayload } from './jwt.payload.interface';

export interface RegisterResponse {
  access_token: string;
  refresh_token: string;
  // user: JwtPayload;
}
