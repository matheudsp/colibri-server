import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchUserDto } from './dto/search-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma, type User, type UserRole } from '@prisma/client';
import type { CreateUserDto } from './dto/create-user.dto';
import { LogHelperService } from '../logs/log-helper.service';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { ROLES } from 'src/common/constants/roles.constant';
import { EmailJobType, type NewAccountJob } from 'src/queue/jobs/email.job';
import { CreateLandlordDto } from './dto/create-landlord.dto';
import { PasswordUtil } from 'src/common/utils/hash.utils';
import { QueueName } from 'src/queue/jobs/jobs';
import { maskString } from 'src/common/utils/mask-string.util';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { VerificationService } from '../verification/verification.service';
import { VerificationContexts } from 'src/common/constants/verification-contexts.constant';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UserPreferences } from 'src/common/interfaces/user.preferences.interface';
import { merge } from 'lodash';
import type { SubmitSurveyDto } from './dto/submit-survey.dto';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    private verificationService: VerificationService,
    @InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue,
  ) {}

  private userSafeFields() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      marketingSurvey: true,
    };
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.validateUserExists(userId);
    return (user.preferences as UserPreferences) || {};
  }

  async updatePreferences(
    userId: string,
    newPreferences: UpdateUserPreferencesDto,
  ) {
    const user = await this.validateUserExists(userId);

    const currentPreferences = (user.preferences as UserPreferences) || {};

    const updatedPreferences = merge(currentPreferences, newPreferences);

    await this.prisma.user.update({
      where: { id: userId },
      data: { preferences: updatedPreferences as any },
    });

    await this.logHelper.createLog(
      userId,
      'UPDATE_PREFERENCES',
      'User',
      userId,
    );

    return { message: 'Preferências atualizadas com sucesso.' };
  }

  /**
   * Encontra todos os usuários administradores ativos no sistema.
   * @returns Uma lista de administradores com nome e e-mail.
   */
  async findAdmins(): Promise<Pick<User, 'name' | 'email'>[]> {
    return this.prisma.user.findMany({
      where: {
        role: ROLES.ADMIN,
        status: true,
      },
      select: {
        name: true,
        email: true,
      },
    });
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
    const { name, email, role, status, cpfCnpj } = filters;

    const where = {};
    if (name) where['name'] = { contains: name, mode: 'insensitive' };
    if (email) where['email'] = { contains: email, mode: 'insensitive' };
    if (cpfCnpj) where['cpfCnpj'] = { equals: cpfCnpj };
    if (role) where['role'] = role;
    if (status !== undefined) where['status'] = status;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        cpfCnpj: true,
        role: true,
        status: true,
      },
    });
  }
  async create(
    data: CreateUserDto | CreateLandlordDto,
    role: UserRole,
    creatorRole?: UserRole,
  ) {
    const { name, email, cpfCnpj, phone, password } = data;

    if (!name || !email || !cpfCnpj || !phone || !password) {
      throw new BadRequestException(
        'Nome, e-mail, CPF/CNPJ, telefone e senha são obrigatórios para criar um novo usuário.',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { cpfCnpj }],
      },
    });

    if (existingUser) {
      let message = 'Já existe uma conta com os dados fornecidos.';
      if (existingUser.email === email) {
        message = 'O e-mail fornecido já está em uso.';
      } else if (existingUser.cpfCnpj === cpfCnpj) {
        message = 'O CPF/CNPJ fornecido já está em uso.';
      }
      throw new ConflictException(message);
    }

    let newUser: User;
    if (role === ROLES.LOCADOR) {
      newUser = await this.createLandlord(data as CreateLandlordDto);
    } else {
      newUser = await this.createTenant(data as CreateUserDto);
    }
    await this.logHelper.createLog(newUser.id, 'REGISTER', 'User', newUser.id);

    const shouldSendPassword =
      creatorRole === ROLES.LOCADOR && newUser.role === ROLES.LOCATARIO;

    this.sendWelcomeEmail(newUser, shouldSendPassword ? password : undefined);

    return newUser;
  }
  async findMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        cpfCnpj: true,
        phone: true,
        incomeValue: true,
        companyType: true,
        birthDate: true,
        street: true,
        number: true,
        complement: true,
        province: true,
        city: true,
        state: true,
        cep: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Aplica a máscara nos dados sensíveis antes de retornar
    return {
      ...user,
      phone: maskString(user.phone, 4), // Revela os últimos 4
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        cpfCnpj: true,
        companyType: true,
        phone: true,
        birthDate: true,
        marketingSurvey: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    // Remova a senha antes de retornar
    // const { password, ...result } = user
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: JwtPayload,
  ) {
    const { actionToken, ...updateData } = updateUserDto;

    if (currentUser.role !== ROLES.ADMIN) {
      if (!actionToken) {
        throw new BadRequestException(
          'O token de verificação (actionToken) é obrigatório para esta ação.',
        );
      }

      await this.verificationService.consumeActionToken(
        actionToken,
        VerificationContexts.UPDATE_USER_PROFILE,
        currentUser.sub,
      );
    }

    if (currentUser.role !== ROLES.ADMIN && currentUser.sub !== id) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar este perfil.',
      );
    }

    if (updateData.role && currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenException(
        'Apenas administradores podem alterar o papel de um usuário.',
      );
    }

    await this.validateUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: this.userSafeFields(),
    });
  }

  async remove(id: string, currentUser: JwtPayload) {
    await this.validateUserExists(id);
    await this.logHelper.createLog(
      currentUser.sub,
      'DEACTIVATE_USER',
      'User',
      id,
    );

    return this.prisma.user.update({
      where: { id },
      data: { status: false },
      select: this.userSafeFields(),
    });
  }

  async restore(id: string, currentUser: JwtPayload) {
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { status: true },
      select: this.userSafeFields(),
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'REACTIVATE_USER',
      'User',
      id,
    );

    return updatedUser;
  }

  async submitSurvey(userId: string, dto: SubmitSurveyDto) {
    const existingSurvey = await this.prisma.userMarketingSurvey.findUnique({
      where: { userId },
    });

    if (existingSurvey) {
      throw new ConflictException('Você já respondeu a esta pesquisa.');
    }

    if (!dto.channel && !dto.preferredPaymentMethod) {
      throw new BadRequestException(
        'Pelo menos uma resposta deve ser fornecida.',
      );
    }

    const survey = await this.prisma.userMarketingSurvey.create({
      data: {
        userId,
        channel: dto.channel,
        preferredPaymentMethod: dto.preferredPaymentMethod,
      },
    });

    await this.logHelper.createLog(
      userId,
      'SUBMIT_MARKETING_SURVEY',
      'UserMarketingSurvey',
      survey.id,
    );

    return { message: 'Pesquisa enviada com sucesso!' };
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
      email?: string;
      cpfCnpj: string;
      name?: string;
      password?: string;
      phone?: string;
    },
    creatorRole: UserRole,
  ): Promise<User> {
    if (data.password) {
      if (!data.name || !data.email || !data.cpfCnpj || !data.phone) {
        throw new BadRequestException(
          'Para criar um novo locatário, é necessário fornecer nome, CPF/CNPJ, telefone e senha.',
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
      const user = await this.prisma.user.findUnique({
        where: {
          cpfCnpj: data.cpfCnpj,
        },
      });
      if (!user) {
        throw new NotFoundException(
          `Nenhum locatário encontrado com o CPF/CNPJ fornecido. Cadastre-o.`,
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
        preferences: {
          notifications: {
            acceptOnlineProposals: false,
          },
        },
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
