import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from 'src/common/decorator/public.decorator';
import { User } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: User;
  logIn: (user: User) => Promise<void>;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    context.switchToHttp().getRequest<AuthenticatedRequest>();

    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (err: unknown) {
      throw new UnauthorizedException(
        err instanceof Error ? err.message : 'Token inválido ou expirado',
      );
    }
  }

  handleRequest<TUser = User>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Acesso não autorizado');
    }
    return user;
  }
}
