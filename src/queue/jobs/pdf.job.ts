import { ContractTemplateData } from 'src/modules/pdfs/types/contract-template.interface';
import { JudicialReportTemplateData } from 'src/modules/pdfs/types/judicial-report-template.interface';

export enum PdfJobType {
  GENERATE_PDF = 'generate-pdf',
}

export interface GeneratePdfJob {
  pdfRecordId: string;
  templateData: ContractTemplateData | JudicialReportTemplateData;
  fileName: string;
  contractId: string;
  templateName: 'CONTRATO_LOCACAO' | 'RELATORIO_JUDICIAL';
}

export type PdfJobData = GeneratePdfJob;
