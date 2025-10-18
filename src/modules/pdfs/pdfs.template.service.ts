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

    const cleanedTemplate = templateHtml.replace(
      /{{[#/>]?[^}]+}}/g,
      (match) => {
        const placeholder = match.match(/[a-zA-Z0-9_.]+/);
        return placeholder ? `{{${placeholder[0]}}}` : '';
      },
    );

    const templateData = {
      landlord: {
        name: landlord.name,
        cpfCnpj: landlord.cpfCnpj,
        street: landlord.street || '',
        number: landlord.number || '',
        province: landlord.province || '',
        city: landlord.city || '',
        state: landlord.state || '',
      },
      property: {
        title: property.title,
        street: property.street || '',
        number: property.number,
        complement: property.complement || '',
        district: property.district || '',
        city: property.city || '',
        state: property.state || '',
        cep: property.cep || '',
        propertyType: property.propertyType,
      },
      tenant: {
        name: tenant.name,
        cpfCnpj: tenant.cpfCnpj,
        email: tenant.email,
      },
      rentAmount: contract.rentAmount.toNumber(),
      condoFee: contract.condoFee?.toNumber(),
      iptuFee: contract.iptuFee?.toNumber(),
      securityDeposit: contract.securityDeposit?.toNumber(),
      durationInMonths: contract.durationInMonths,
      startDate: format(new Date(contract.startDate), 'dd/MM/yyyy'),
      endDate: format(new Date(contract.endDate), 'dd/MM/yyyy'),
    };

    return {
      templateHtml: cleanedTemplate,
      templateData,
    };
  }
}
