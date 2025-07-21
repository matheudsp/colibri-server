import { JwtPayload } from './jwt.payload.interface';

export interface RegisterResponse {
  token: string;
  user: JwtPayload;
}
