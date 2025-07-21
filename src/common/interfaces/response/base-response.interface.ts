import { Metadata } from './metadata.interface';

export interface BaseResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: Metadata;
  timestamp: string;
}
