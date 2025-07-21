import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';
import { RequestWithUser } from '../common/interfaces/request.user.interface';

export const loggerConfig = (configService: ConfigService): Params => ({
  pinoHttp: {
    level: configService.get('LOG_LEVEL', 'info'),
    transport:
      configService.get('NODE_ENV') !== 'production'
        ? { target: 'pino-pretty' }
        : undefined, 
    serializers: {
      req: (req: Request) => ({
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(
          Object.entries(req.headers).filter(
            ([key]) => !['authorization', 'cookie'].includes(key.toLowerCase()),
          ),
        ),
      }),
    },
    customProps: (req) => {
      const typedReq = req as RequestWithUser;
      return {
        context: 'HTTP',
        user: typedReq.user?.sub,
      };
    },
  },
});
