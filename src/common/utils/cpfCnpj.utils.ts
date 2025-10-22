export class cpfCnpjUtils {
  static formatCpfCnpj(value: string): string {
    if (!value) return '';

    const cleaned = value.replace(/\D/g, ''); // Remove caracteres não numéricos

    if (cleaned.length === 11) {
      // Formato CPF: XXX.XXX.XXX-XX
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    if (cleaned.length === 14) {
      // Formato CNPJ: XX.XXX.XXX/XXXX-XX
      return cleaned.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        '$1.$2.$3/$4-$5',
      );
    }

    return value; // Retorna o valor original se não for 11 ou 14 dígitos
  }
}
