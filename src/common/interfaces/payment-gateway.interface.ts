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
  object: string;
  id: string;
  name: string;
  email: string;
  loginEmail: string;
  cpfCnpj: string;
  phone: string | null;
  mobilePhone: string;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  birthDate?: string;
  personType: string;
  companyType: string | null;
  walletId: string;
  apiKey: string;
  accountNumber: {
    agency: string;
    account: string;
    accountDigit: string;
  };
  incomeValue: number;
  commercialInfoExpiration: {
    isExpired: boolean;
    scheduledDate: string;
  } | null;
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
