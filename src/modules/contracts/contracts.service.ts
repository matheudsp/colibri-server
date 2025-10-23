import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractStatus, Prisma, UserRole, type Photo } from '@prisma/client';
import { ROLES } from 'src/common/constants/roles.constant';
import { StorageService } from 'src/storage/storage.service';
import { cpfCnpjUtils } from 'src/common/utils/cpfCnpj.utils';
import { CurrencyUtils } from 'src/common/utils/currency.utils';
import { EnumUtils } from 'src/common/utils/enum.utils';
import { format } from 'date-fns';
import { ContractTemplateData } from '../pdfs/types/contract-template.interface';
import { renderHtmlFromTemplateString } from '../pdfs/utils/pdf-generator';
@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async findAll(
    { page, limit }: { page: number; limit: number },
    currentUser: { sub: string; role: string },
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.ContractWhereInput = {};

    if (currentUser.role === ROLES.LOCADOR) {
      where.landlordId = currentUser.sub;
    } else if (currentUser.role === ROLES.LOCATARIO) {
      where.tenantId = currentUser.sub;
    } else if (currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para ver todos os contratos.',
      );
    }

    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        skip,
        take: limit,
        where,
        select: {
          id: true,
          status: true,
          rentAmount: true,
          condoFee: true,
          iptuFee: true,
          startDate: true,
          endDate: true,
          durationInMonths: true,
          guaranteeType: true,
          securityDeposit: true,
          createdAt: true,
          updatedAt: true,
          propertyId: true,
          landlordId: true,
          tenantId: true,
          alterationRequestReason: true,
          contractFilePath: true,
          signedContractFilePath: true,
          clicksignEnvelopeId: true,
          contractHtml: false,
          documents: false,
          signatureRequests: false,
          GeneratedPdf: false,
          paymentsOrders: false,
          property: {
            select: {
              title: true,
              photos: {
                where: { isCover: true },
                take: 1,
              },
            },
          },
          landlord: { select: { name: true, email: true } },
          tenant: { select: { name: true, email: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    const dataWithSinglePhoto = contracts.map((contract) => {
      const coverPhoto = contract.property.photos.find((p) => p.isCover);
      const firstPhoto = contract.property.photos[0];
      const photoToUse = coverPhoto || firstPhoto;

      const photosWithUrl: (Photo & { url: string })[] = [];
      if (photoToUse) {
        photosWithUrl.push({
          ...photoToUse,
          url: this.storageService.getPublicImageUrl(photoToUse.filePath),
        });
      }

      return {
        ...contract,
        property: {
          ...contract.property,
          photos: photosWithUrl,
        },
      };
    });

    return {
      data: dataWithSinglePhoto,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, currentUser: { sub: string; role: string }) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        rentAmount: true,
        condoFee: true,
        iptuFee: true,
        startDate: true,
        endDate: true,
        durationInMonths: true,
        guaranteeType: true,
        securityDeposit: true,
        createdAt: true,
        updatedAt: true,
        propertyId: true,
        landlordId: true,
        tenantId: true,
        alterationRequestReason: true,
        contractFilePath: true,
        signedContractFilePath: true,
        clicksignEnvelopeId: true,
        contractHtml: false,
        paymentsOrders: {
          include: {
            charge: {
              select: { bankSlipUrl: true, transactionReceiptUrl: true },
            },
          },
        },
        signatureRequests: true,
        property: {
          include: {
            photos: {
              where: { isCover: true },
              take: 1,
            },
          },
        },
        landlord: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, email: true } },
        documents: { select: { id: true, status: true, type: true } },
        GeneratedPdf: true,
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contrato com ID "${id}" não encontrado.`);
    }

    if (
      contract.landlordId !== currentUser.sub &&
      contract.tenantId !== currentUser.sub &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new UnauthorizedException(
        'Você não tem permissão para visualizar este contrato.',
      );
    }
    const coverPhoto = contract.property.photos[0];
    const photosWithUrl: (Photo & { url: string })[] = [];
    if (coverPhoto) {
      photosWithUrl.push({
        ...coverPhoto,
        url: this.storageService.getPublicImageUrl(coverPhoto.filePath),
      });
    }

    return {
      ...contract,
      property: {
        ...contract.property,
        photos: photosWithUrl,
      },
    };
  }

  async getContractHtmlForTenantAcceptance(
    contractId: string,
    tenantUserId: string,
  ): Promise<{ renderedHtml: string }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        property: { include: { landlord: true } },
        tenant: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }
    if (contract.tenantId !== tenantUserId) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar este contrato para aceite.',
      );
    }
    // Verifica o status correto
    if (contract.status !== ContractStatus.AGUARDANDO_ACEITE_INQUILINO) {
      throw new BadRequestException(
        `O contrato não está aguardando seu aceite (Status atual: ${contract.status}).`,
      );
    }
    if (!contract.contractHtml) {
      this.logger.error(
        `Contrato ${contractId} está aguardando aceite, mas não possui contractHtml salvo.`,
      );
      throw new InternalServerErrorException(
        'O conteúdo do contrato não foi encontrado ou ainda não foi finalizado pelo locador.',
      );
    }
    if (!contract.property?.landlord) {
      this.logger.error(
        `Dados do locador não encontrados para o contrato ${contractId}.`,
      );
      throw new InternalServerErrorException(
        'Erro ao carregar dados do locador.',
      );
    }

    const templateData: ContractTemplateData = {
      landlord: {
        name: contract.property.landlord.name,
        cpfCnpj: cpfCnpjUtils.formatCpfCnpj(contract.property.landlord.cpfCnpj),
        street: contract.property.landlord.street,
        number: contract.property.landlord.number,
        province: contract.property.landlord.province,
        city: contract.property.landlord.city,
        state: contract.property.landlord.state,
        email: contract.property.landlord.email,
      },
      property: {
        title: contract.property.title,
        street: contract.property.street,
        number: contract.property.number,
        complement: contract.property.complement?.toString() || undefined,
        district: contract.property.district,
        city: contract.property.city,
        state: contract.property.state,
        cep: contract.property.cep,
        propertyType: contract.property.propertyType,
      },
      tenant: {
        name: contract.tenant.name,
        cpfCnpj: cpfCnpjUtils.formatCpfCnpj(contract.tenant.cpfCnpj),
        email: contract.tenant.email,
      },
      contract: {
        totalAmount:
          CurrencyUtils.formatCurrency(
            contract.rentAmount.toNumber() +
              (contract.condoFee?.toNumber() ?? 0) +
              (contract.iptuFee?.toNumber() ?? 0),
          ) || 'R$ 0,00',
        rentAmount:
          CurrencyUtils.formatCurrency(contract.rentAmount.toNumber()) ||
          'R$ 0,00',
        condoFee: CurrencyUtils.formatCurrency(contract.condoFee?.toNumber()),
        iptuFee: CurrencyUtils.formatCurrency(contract.iptuFee?.toNumber()),
        securityDeposit: CurrencyUtils.formatCurrency(
          contract.securityDeposit?.toNumber(),
        ),
        durationInMonths: contract.durationInMonths.toString(),
        guaranteeType: EnumUtils.formatGuaranteeType(contract.guaranteeType),
        startDateDay: format(new Date(contract.startDate), 'dd'),
        startDate: format(new Date(contract.startDate), 'dd/MM/yyyy'),
        endDate: format(new Date(contract.endDate), 'dd/MM/yyyy'),
      },
      todayDate: format(new Date(), 'dd/MM/yyyy'),
    };
    try {
      const renderedHtml = renderHtmlFromTemplateString(
        contract.contractHtml,
        templateData,
      );
      console.log(renderedHtml);
      return { renderedHtml };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        `Erro inesperado ao chamar renderHtmlFromTemplateString para contrato ${contractId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Ocorreu um erro ao preparar a visualização do contrato.',
      );
    }
  }
}
