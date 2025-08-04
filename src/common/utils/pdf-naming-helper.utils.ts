import { PdfType } from '@prisma/client';

export const getPdfFileName = (
  pdfType: PdfType,
  contractId: string, // Usaremos o ID do contrato para garantir unicidade
): string => {
  switch (pdfType) {
    case 'CONTRATO_LOCACAO':
      return `contrato-${contractId}.pdf`;
    default:
      return `documento-${contractId}.pdf`;
  }
};
