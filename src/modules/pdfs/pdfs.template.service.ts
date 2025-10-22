import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from '../users/users.service';
import * as fs from 'fs';
import * as path from 'path';
import { GetContractTemplateResponseDto } from './dto/get-contract-template-response.dto';
import { GuaranteeType } from '@prisma/client';
import { format } from 'date-fns';
import { cpfCnpjUtils } from 'src/common/utils/cpfCnpj.utils';
import { EnumUtils } from 'src/common/utils/enum.utils';
import { CurrencyUtils } from 'src/common/utils/currency.utils';
import type { ContractTemplateData } from './types/contract-template.interface';

@Injectable()
export class PdfsTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async getContractTemplateWithData(
    contractId: string,
  ): Promise<GetContractTemplateResponseDto> {
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

    const { property, tenant, guaranteeType } = contract;
    const landlord = property?.landlord;

    if (!property || !landlord || !tenant) {
      throw new InternalServerErrorException(
        'Dados associados ao contrato (imóvel, locador ou locatário) não foram encontrados.',
      );
    }

    let templateName: string;
    switch (guaranteeType) {
      case GuaranteeType.DEPOSITO_CAUCAO:
        templateName = 'CONTRATO_DEPOSITO_CAUCAO.hbs';
        break;
      case GuaranteeType.SEM_GARANTIA:
      default:
        templateName = 'CONTRATO_SEM_GARANTIA.hbs';
        break;
    }

    const templatePath = path.resolve(__dirname, 'templates', templateName);

    if (!fs.existsSync(templatePath)) {
      throw new InternalServerErrorException(
        `Arquivo de template '${templateName}' não encontrado no servidor.`,
      );
    }
    const templateHtml = fs.readFileSync(templatePath, 'utf-8');
    let processedTemplateHtml = templateHtml;
    // Verifica se os campos opcionais existem e têm valor maior que zero
    const hasCondoFee = contract.condoFee && contract.condoFee.toNumber() > 0;
    const hasIptuFee = contract.iptuFee && contract.iptuFee.toNumber() > 0;

    if (!hasCondoFee) {
      // Remove a linha <li> que contém "Condomínio"
      processedTemplateHtml = processedTemplateHtml.replace(
        /<li[^>]*>.*Condomínio.*<\/li>/gi,
        '',
      );
    }

    if (!hasIptuFee) {
      // Remove a linha <li> que contém "IPTU"
      processedTemplateHtml = processedTemplateHtml.replace(
        /<li[^>]*>.*IPTU.*<\/li>/gi,
        '',
      );
    }

    const cleanedTemplate = processedTemplateHtml.replace(
      /{{[#/>]?[^}]+}}/g,
      (match) => {
        const placeholder = match.match(/[a-zA-Z0-9_.]+/);
        return placeholder ? `{{${placeholder[0]}}}` : '';
      },
    );

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
        complement: contract.property.complement?.toString() || '',
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

    return {
      templateHtml: cleanedTemplate,
      templateData,
    };
  }
}
