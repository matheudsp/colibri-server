import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { PrismaService } from 'src/prisma/prisma.service';

// Função auxiliar para extrair cookies do cabeçalho
const parseCookie = (str: string | undefined): Record<string, string> =>
  str
    ?.split(';')
    .map((v) => v.split('='))
    .reduce(
      (acc, v) => {
        if (v.length === 2) {
          acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(
            v[1].trim(),
          );
        }
        return acc;
      },
      {} as Record<string, string>,
    ) || {};

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:8080',
      'http://localhost:3001',
      'https://www.valedosol.space',
      'https://www.locaterra.com.br',
    ],
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const cookies = parseCookie(client.handshake.headers.cookie);
    const token = cookies?.accessToken;

    if (!token) {
      this.logger.warn(
        `Cliente ${client.id} tentou conectar sem o cookie 'accessToken'.`,
      );
      client.disconnect();
      return;
    }

    try {
      // 2. Verifica o token JWT extraído do cookie.
      const payload: JwtPayload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new Error('Usuário do token não encontrado no banco de dados');
      }

      client.join(user.id);
      this.logger.log(
        `Cliente ${client.id} (Usuário ${user.id}) conectado e inscrito na sala.`,
      );
    } catch (error) {
      this.logger.error(
        `Falha na autenticação do WebSocket para o cliente ${client.id}.`,
        error.message,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente ${client.id} desconectado.`);
  }

  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(userId).emit('new_notification', notification);
    this.logger.log(
      `Notificação em tempo real enviada para o usuário ${userId}`,
    );
  }
}
