import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchUserDto } from './dto/search-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma, type User, type UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import type { CreateUserDto } from './dto/create-user.dto';
import { LogHelperService } from '../logs/log-helper.service';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { ROLES } from 'src/common/constants/roles.constant';
import { EmailJobType, type NewAccountJob } from 'src/queue/jobs/email.job';
import type { CreateLandlordDto } from './dto/create-landlord.dto';
import type { CreateAsaasCustomerDto } from 'src/common/interfaces/payment-gateway.interface';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { PasswordUtil } from 'src/common/utils/hash.utils';
@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    private paymentGatewayService: PaymentGatewayService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  private userSafeFields() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    };
  }

  async findAll(params: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 10 } = params;

    const where: Prisma.UserWhereInput = {};
    if (status !== undefined) {
      if (status === 'true') where['status'] = true;
      else if (status === 'false') where['status'] = false;
    }

    try {
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          select: this.userSafeFields(),
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data: users,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      throw new InternalServerErrorException('Erro ao buscar usuários');
    }
  }

  async search(filters: SearchUserDto) {
    const { name, email, role, status } = filters;

    const where = {};
    if (name) where['name'] = { contains: name, mode: 'insensitive' };
    if (email) where['email'] = { contains: email, mode: 'insensitive' };
    if (role) where['role'] = role;
    if (status !== undefined) where['status'] = status;

    return this.prisma.user.findMany({
      where,
      select: this.userSafeFields(),
    });
  }
  async create(
    data: CreateUserDto | CreateLandlordDto,
    role: UserRole,
    creatorRole?: UserRole,
  ) {
    const { email, cpfCnpj, password } = data;
    const whereClause: Prisma.UserWhereInput = cpfCnpj
      ? { OR: [{ email }, { cpfCnpj }] }
      : { email };

    const existingUser = await this.prisma.user.findFirst({
      where: whereClause,
    });

    if (existingUser) {
      throw new ConflictException(
        'E-mail ou CPF/CNPJ já associado a outra conta.',
      );
    }
    if (!data.name || !data.password || !email || !cpfCnpj) {
      throw new BadRequestException(
        'Para criar um novo usuário, é necessário fornecer nome, email e CPF/CNPJ.',
      );
    }
    let newUser: User;
    if (role === ROLES.LOCADOR) {
      newUser = await this.createLandlord(data as CreateLandlordDto);
    } else {
      newUser = await this.createTenant(data as CreateUserDto);
    }
    const shouldSendPassword =
      creatorRole === ROLES.LOCADOR && newUser.role === ROLES.LOCATARIO;

    this.sendWelcomeEmail(newUser, shouldSendPassword ? password : undefined);

    return newUser;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSafeFields(),
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.validateUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        ...(updateUserDto.role && { role: updateUserDto.role }),
      },
      select: this.userSafeFields(),
    });
  }

  async remove(id: string) {
    await this.validateUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: { status: false },
      select: this.userSafeFields(),
    });
  }

  async restore(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: true },
      select: this.userSafeFields(),
    });
  }

  /**
   * Garante que um usuário tenha um ID de cliente correspondente no gateway de pagamento.
   * Se não existir, cria o cliente no gateway e atualiza o registro do usuário.
   * @param userId - O ID do usuário no seu banco de dados.
   * @returns O ID do cliente no gateway de pagamento (asaasCustomerId).
   */
  async getOrCreateGatewayCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(
        'Usuário não encontrado para criar cliente no gateway.',
      );
    }

    if (user.asaasCustomerId) {
      return user.asaasCustomerId;
    }

    const customerData: CreateAsaasCustomerDto = {
      name: user.name,
      cpfCnpj: user.cpfCnpj,
      email: user.email,
      phone: user.phone!,
    };

    const newGatewayCustomer =
      await this.paymentGatewayService.createCustomer(customerData);

    await this.prisma.user.update({
      where: { id: userId },
      data: { asaasCustomerId: newGatewayCustomer.id },
    });

    return newGatewayCustomer.id;
  }

  /**
   * Encontra um locatário existente pelo email ou cria um novo.
   * A decisão é baseada na presença do campo 'password'.
   * @param data - Dados do locatário (email, cpf, nome, senha, telefone).
   * @param creatorRole - A role do usuário que está criando o locatário (ex: LOCADOR).
   * @returns O usuário encontrado ou recém-criado.
   */
  async findOrCreateTenant(
    data: {
      email: string;
      cpfCnpj?: string;
      name?: string;
      password?: string;
      phone?: string;
    },
    creatorRole: UserRole,
  ): Promise<User> {
    if (data.password) {
      if (!data.name || !data.cpfCnpj) {
        throw new BadRequestException(
          'Para criar um novo locatário, é necessário fornecer nome, CPF, telefone e senha.',
        );
      }

      const createUserData: CreateUserDto = {
        email: data.email,
        name: data.name,
        cpfCnpj: data.cpfCnpj,
        password: data.password,
        phone: data.phone,
      };

      return this.create(createUserData, ROLES.LOCATARIO, creatorRole);
    } else {
      if (!data.cpfCnpj) {
        throw new BadRequestException(
          'Para associar um locatário existente, o CPF/CNPJ é obrigatório.',
        );
      }
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: data.email }, { cpfCnpj: data.cpfCnpj }],
        },
      });

      if (!user) {
        throw new NotFoundException(
          `Nenhum locatário encontrado com o email ou CPF/CNPJ fornecido. Para cadastrá-lo, forneça também nome, telefone e uma senha.`,
        );
      }

      return user;
    }
  }

  private async validateUserExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  private async createLandlord(data: CreateLandlordDto) {
    const isCPF = data.cpfCnpj.length === 11;

    if (isCPF && !data.birthDate) {
      throw new BadRequestException(
        'Data de nascimento é obrigatória para pessoas físicas.',
      );
    }
    const hashedPassword = await PasswordUtil.hash(data.password);

    return this.prisma.user.create({
      data: {
        ...data,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
        cpfCnpj: data.cpfCnpj,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        role: ROLES.LOCADOR,
      },
    });
  }

  private async createTenant(data: CreateUserDto) {
    const hashedPassword = await PasswordUtil.hash(data.password);

    return this.prisma.user.create({
      data: {
        ...data,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
        cpfCnpj: data.cpfCnpj,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        role: ROLES.LOCATARIO,
      },
    });
  }

  private async sendWelcomeEmail(
    user: {
      name: string;
      email: string;
    },
    originalPassword?: string,
  ): Promise<void> {
    const jobPayload: NewAccountJob = {
      user: { name: user.name, email: user.email },
      temporaryPassword: originalPassword,
    };
    await this.emailQueue.add(EmailJobType.NEW_ACCOUNT, jobPayload);
  }
}
