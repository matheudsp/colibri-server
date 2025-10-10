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

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // Evento padrão: Cliente conectado
  async handleConnection(client: Socket) {
    const cookies = parseCookie(client.handshake.headers.cookie);
    const token = cookies?.accessToken;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      // Verifica o token JWT extraído do cookie.
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
    } catch (error) {
      client.disconnect();
    }
  }
  // Evento padrão: Cliente desconectado
  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }
  // Método personalizado: Enviar notificação para um usuário específico
  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(userId).emit('new_notification', notification);
  }
}
