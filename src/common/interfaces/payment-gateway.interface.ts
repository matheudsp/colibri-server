import type { CompanyType } from '@prisma/client';

export interface CreateAsaasSubAccountDto {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string; // Obrigatório para Pessoa Física
  companyType?: CompanyType; // Obrigatório para Pessoa Jurídica
  mobilePhone: string;
  incomeValue: number; // Renda/Faturamento mensal
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
}

export interface CreateAsaasSubAccountResponse {
  id: string;
  loginEmail: string;
  cpfCnpj: string;
  birthDate?: string;
  personType: string;
  companyType: string;
  walletId: string;
  accountNumber: {
    agency: string;
    account: string;
    accountDigit: string;
  };
  commercialInfoExpiration: {
    isExpired: boolean;
    scheduledDate: string;
  };
}
export interface CreateAsaasCustomerDto {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
}

export interface CreateAsaasChargeDto {
  customer: string; // ID do cliente Asaas
  billingType: 'BOLETO' | 'PIX';
  dueDate: string;
  value: number;
  description?: string;
  split?: {
    walletId: string;
    fixedValue?: number;
    percentualValue?: number;
  }[];
}
