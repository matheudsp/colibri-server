import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class RateLimitService extends ThrottlerGuard {
  async handleRequest(request: ThrottlerRequest): Promise<boolean> {
    const result = await super.handleRequest(request);

    if (!result) {
      const context = request.context;
      const req = context.switchToHttp().getRequest<{ ip: string }>();
      console.log(`Rate limit exceeded for IP: ${req.ip}`);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Você atingiu o limite de requisições. Tente novamente mais tarde.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return result;
  }
}
