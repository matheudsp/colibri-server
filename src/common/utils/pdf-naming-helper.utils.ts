import { PdfType } from '@prisma/client';

export const getPdfFileName = (
  pdfType: PdfType,
  contractId: string, // Usaremos o ID do contrato para garantir unicidade
): string => {
  switch (pdfType) {
    case 'CONTRATO_LOCACAO':
      return `${pdfType}.pdf`;
    default:
      return `documento-${contractId}.pdf`;
  }
};
