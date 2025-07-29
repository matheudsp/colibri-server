export enum BankSlipJobType {
  GENERATE_MONTHLY_BANK_SLIPS = 'generate-monthly-bank-slips',

  // CLEAN_UP_LOGS = 'clean-up-logs',
}

export interface GenerateMonthlyBankSlipsJob {
  paymentOrderId: string;
}
