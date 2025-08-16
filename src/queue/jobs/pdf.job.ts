import { PdfType } from '@prisma/client';
import { ContractTemplateData } from 'src/modules/pdfs/types/contract-template.interface';

export enum PdfJobType {
  GENERATE_CONTRACT_PDF = 'generate-contract-pdf',
}

export interface GenerateContractPdfJob {
  pdfRecordId: string;
  templateData: ContractTemplateData;
  fileName: string;
  contractId: string;
}

export type PdfJobData = GenerateContractPdfJob;
