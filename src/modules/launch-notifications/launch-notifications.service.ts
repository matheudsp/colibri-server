// import {
//   ConflictException,
//   Injectable,
//   InternalServerErrorException,
// } from '@nestjs/common';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { CreateLaunchNotificationDto } from './dto/create-launch-notification.dto';
// import { Prisma } from '@prisma/client';

// @Injectable()
// export class LaunchNotificationsService {
//   constructor(private readonly prisma: PrismaService) {}

//   async create(dto: CreateLaunchNotificationDto): Promise<{ message: string }> {
//     try {
//       await this.prisma.launchNotification.create({
//         data: {
//           email: dto.email,
//         },
//       });
//       return {
//         message:
//           'E-mail cadastrado com sucesso! Avisaremos você no lançamento.',
//       };
//     } catch (error) {
//       if (
//         error instanceof Prisma.PrismaClientKnownRequestError &&
//         error.code === 'P2002'
//       ) {
//         // P2002 é o código de erro do Prisma para violação de constraint única (unique)
//         throw new ConflictException(
//           'Este e-mail já foi cadastrado em nossa lista.',
//         );
//       }
//       throw new InternalServerErrorException(
//         'Não foi possível cadastrar o e-mail no momento.',
//       );
//     }
//   }
// }
