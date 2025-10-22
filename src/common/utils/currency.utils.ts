export class CurrencyUtils {
  /**
   * Formata um valor numérico como moeda no padrão brasileiro (BRL).
   * @param value O número a ser formatado.
   * @returns A string formatada, ex: "R$ 1.500,00". Retorna 'N/A' se o valor for nulo ou indefinido.
   */
  static formatCurrency(value: number | null | undefined): string | undefined {
    if (value === null || value === undefined) {
      // return 'N/A';
      return;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }
}
