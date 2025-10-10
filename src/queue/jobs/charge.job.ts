export enum ChargeJobType {
  GENERATE_MONTHLY_CHARGE = 'generate-monthly-charge',

  // CLEAN_UP_LOGS = 'clean-up-logs',
}

export interface GenerateMonthlyChargeJob {
  paymentOrderId: string;
}
