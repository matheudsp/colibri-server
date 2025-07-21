import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';

@Catch(UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  constructor(private readonly jwtService: JwtService) {}

  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isVistoriadorRequest = this.isVistoriadorRequest(request);

    response.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: exception.message,
      userType: isVistoriadorRequest ? 'vistoriador' : 'default',
      path: request.url,
    });
  }

  private isVistoriadorRequest(request: Request): boolean {
    if (request.url.includes('/auth/login') && request.method === 'POST') {
      const body = request.body as { accessKeyToken?: string };
      return !!body?.accessKeyToken;
    }

    return false;
  }
}
