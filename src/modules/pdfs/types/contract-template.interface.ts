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
  };
  /**
   * Dados do Imóvel que está sendo alugado.
   */
  property: {
    title: string;
    propertyType: string;
    street: string | null;
    number: string;
    complement?: string | null;
    province: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
  };
  /**
   * Detalhes específicos do contrato (valores, datas, etc.)
   * Renomeado de 'contract' para 'contractDetails' para evitar conflito de nome
   */
  contract: {
    totalAmount: string;
    rentAmount: string;
    condoFee?: string | undefined;
    iptuFee?: string | undefined;
    securityDeposit?: string | undefined;
    durationInMonths: string;
    guaranteeType: string;
    startDateDay: string;
    startDate: string;
    endDate: string;
  };

  /**
   * Data atual formatada para exibição (ex: assinatura).
   */
  todayDate: string; // Formatado como string (dd/MM/yyyy)
}
