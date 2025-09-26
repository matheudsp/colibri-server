import {
  Contract,
  Document,
  Log,
  PaymentOrder,
  Property,
  User,
} from '@prisma/client';

export interface JudicialReportTemplateData {
  contract: Contract;
  landlord: User;
  tenant: User;
  property: Property;
  payments: PaymentOrder[];
  documents: (Document & { url: string })[];
  signedContractUrl: string | null;
  logs: Log[];
  now: Date;
  totalAmount: number;
}
