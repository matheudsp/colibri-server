import { GuaranteeType } from '@prisma/client';

export class EnumUtils {
  static formatGuaranteeType(guaranteeType: GuaranteeType): string {
    switch (guaranteeType) {
      case GuaranteeType.DEPOSITO_CAUCAO:
        return 'Depósito Caução';
      case GuaranteeType.SEM_GARANTIA:
        return 'Sem Garantia';

      default:
        const formatted =
          guaranteeType.charAt(0).toUpperCase() +
          guaranteeType.slice(1).toLowerCase().replace(/_/g, ' ');
        return formatted;
    }
  }
}
