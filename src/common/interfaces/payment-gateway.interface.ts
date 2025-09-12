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
  webhooks?: {
    name: string;
    url: string;
    email: string;
    sendType: string;
    interrupted: boolean;
    enabled: boolean;
    apiVersion: number;
    authToken: string;
    events: string[];
  }[];
}

export interface CreateAsaasSubAccountResponse {
  object: string;
  id: string;
  name: string;
  email: string;
  loginEmail: string;
  phone: string | null;
  mobilePhone: string;
  address: string;
  addressNumber: string;
  complement: string | null;
  province: string;
  postalCode: string;
  cpfCnpj: string;
  birthDate?: string;
  personType: 'FISICA' | 'JURIDICA';
  companyType: CompanyType | null;
  city: number;
  state: string;
  country: string;
  tradingName: string | null;
  site: string | null;
  walletId: string;
  accountNumber: {
    agency: string;
    account: string;
    accountDigit: string;
  };
  commercialInfoExpiration: {
    isExpired: boolean;
    scheduledDate: string;
  } | null;
  apiKey: string;
  authTokenSent: string;
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
  daysAfterDueDateToRegistrationCancellation?: number;
  fine?: {
    value: number;
    type?: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
  };
}

export interface CreateAsaasTransferDto {
  value: number;
  bankAccount: {
    bank: string;
    accountName: string;
    ownerName: string;
    cpfCnpj: string;
    agency: string;
    account: string;
    accountDigit: string;
    bankAccountType: 'CONTA_CORRENTE' | 'CONTA_POUPANCA';
  };
}
export interface CreateAsaasPixTransferDto {
  operationType: 'PIX' | 'TED';
  value: number;
  pixAddressKey: string;
  pixAddressKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  description?: string;
  // externalReference?: string;
}
export interface WebhookEvent {
  id: 'evt_d26e303b238e509335ac9ba210e51b0f&9922354';
  event: 'PAYMENT_RECEIVED';
  dateCreated: '2025-07-29 18:37:09';
  payment: {
    object: 'payment';
    id: 'pay_yhv4jv8njez9azw4';
    dateCreated: '2025-07-29';
    customer: 'cus_000006892418';
    checkoutSession: null;
    paymentLink: null;
    value: 1314;
    netValue: 1312.01;
    originalValue: null;
    interestValue: null;
    description: 'Aluguel Casa Teste - venc. 29/08/2025';
    billingType: 'BOLETO';
    canBePaidAfterDueDate: true;
    confirmedDate: '2025-07-29';
    pixTransaction: null;
    status: 'RECEIVED';
    dueDate: '2025-08-29';
    originalDueDate: '2025-08-29';
    paymentDate: '2025-07-29';
    clientPaymentDate: '2025-07-29';
    installmentNumber: null;
    invoiceUrl: 'https://sandbox.asaas.com/i/yhv4jv8njez9azw4';
    invoiceNumber: '10647027';
    externalReference: null;
    deleted: false;
    anticipated: false;
    anticipable: false;
    creditDate: '2025-07-29';
    estimatedCreditDate: '2025-07-29';
    transactionReceiptUrl: 'https://sandbox.asaas.com/comprovantes/h/UEFZTUVOVF9SRUNFSVZFRDpwYXlfeWh2NGp2OG5qZXo5YXp3NA%3D%3D';
    nossoNumero: '11203010';
    bankSlipUrl: 'https://sandbox.asaas.com/b/pdf/yhv4jv8njez9azw4';
    lastInvoiceViewedDate: null;
    lastBankSlipViewedDate: null;
    discount: { value: 0; limitDate: null; dueDateLimitDays: 0; type: 'FIXED' };
    fine: { value: 0; type: 'FIXED' };
    interest: { value: 0; type: 'PERCENTAGE' };
    split: [[Object]];
    postalService: false;
    custody: null;
    escrow: null;
    refunds: null;
  };
}
