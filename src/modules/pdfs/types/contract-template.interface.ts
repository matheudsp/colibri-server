export interface ContractTemplateData {
  /**
   * Dados do Locador (proprietário).
   */
  landlord: {
    name: string;
    cpfCnpj: string;
    street: string | null;
    number: string | null;
    province: string | null;
    city: string | null;
    state: string | null;
    email: string;
  };
  /**
   * Dados do Locatário (inquilino).
   */
  tenant: {
    name: string;
    cpfCnpj: string;
    email: string;
    // O endereço do locatário é opcional no template, mas pode ser adicionado aqui.
  };
  /**
   * Dados do Imóvel que está sendo alugado.
   */
  property: {
    propertyType: string;
    street: string | null;
    number: string;
    complement?: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
  };
  /**
   * A data de início do contrato.
   * Usada para o prazo e para determinar o dia do vencimento.
   */
  startDate: Date | string;
  /**
   * A data de término do contrato.
   */
  endDate: Date | string;
  /**
   * Duração do contrato em meses (ex: 30).
   */
  durationInMonths: number;
  /**
   * Valor do aluguel (sem taxas).
   */
  rentAmount: number;
  /**
   * Valor da taxa de condomínio (opcional).
   */
  condoFee?: number | null;
  /**
   * Valor da taxa de IPTU (opcional).
   */
  iptuFee?: number | null;
  totalAmount: number;
  /**
   * O tipo de garantia (ex: "DEPOSITO_CAUCAO", "FIADOR").
   * É um enum do Prisma, mas aqui pode ser tratado como string.
   */
  guaranteeType: string;
  /**
   * O valor do depósito caução, se aplicável.
   */
  securityDeposit?: number | null;
  /**
   * A data atual, usada para preencher a data da assinatura no final do contrato.
   */
  now: Date | string;
}
