import * as Handlebars from 'handlebars';
import { DateTime } from 'luxon';

export function registerHandlebarsHelpers(): void {
  /**
   * Formata um valor numérico como moeda no padrão brasileiro (BRL).
   * Exemplo: {{formatCurrency rentAmount}} -> "R$ 2.500,00"
   */
  Handlebars.registerHelper(
    'formatCurrency',
    (value: number | null | undefined): string => {
      if (value === null || value === undefined) {
        return 'N/A';
      }
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    },
  );

  /**
   * Formata uma data para um formato legível.
   * Exemplo: {{formatDate contract.startDate "dd/MM/yyyy"}} -> "01/08/2025"
   */
  Handlebars.registerHelper(
    'formatDate',
    (date: Date | string | undefined, pattern = 'dd/MM/yyyy'): string => {
      if (!date) return '';
      try {
        const dt =
          typeof date === 'string'
            ? DateTime.fromISO(date)
            : DateTime.fromJSDate(date);
        return dt.toFormat(pattern, { locale: 'pt-BR' });
      } catch (error) {
        console.error('Handlebars Helper: Erro ao formatar data.', error);
        return '';
      }
    },
  );

  /**
   * Formata um CPF.
   * Exemplo: {{formatCPF user.cpf}} -> "123.456.789-00"
   */
  Handlebars.registerHelper(
    'formatCPF',
    (cpf: string | null | undefined): string => {
      if (!cpf) return '';
      return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    },
  );

  /**
   * Formata um CEP.
   * Exemplo: {{formatCEP property.cep}} -> "123.456.789-00"
   */
  Handlebars.registerHelper(
    'formatCEP',
    (cep: string | null | undefined): string => {
      if (!cep || typeof cep !== 'string' || cep.length !== 8) {
        return cep || '';
      }
      return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    },
  );

  /**
   * Formata um número de telefone.
   * Exemplo: {{formatPhone user.phone}} -> "(11) 98765-4321"
   */
  Handlebars.registerHelper(
    'formatPhone',
    (phone: string | null | undefined): string => {
      if (!phone) return '';
      if (phone.length === 11) {
        return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      }
      if (phone.length === 10) {
        return phone.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
      }
      return phone;
    },
  );

  /**
   * Formata o tipo de garantia do contrato.
   * @example {{formatGuaranteeType contract.guaranteeType}} -> "Depósito Caução"
   */
  Handlebars.registerHelper(
    'formatGuaranteeType',
    (type: string | null | undefined): string => {
      if (!type) {
        return 'N/A';
      }

      switch (type) {
        case 'DEPOSITO_CAUCAO':
          return 'Depósito Caução';
        case 'FIADOR':
          return 'Fiador';
        case 'SEGURO_FIANCA':
          return 'Seguro Fiança';
        case 'SEM_GARANTIA':
          return 'Sem Garantia';
        default:
          // Retorna o próprio valor se não for um tipo conhecido
          return type;
      }
    },
  );

  /**
   * Helper de igualdade para ser usado em blocos condicionais.
   * Exemplo: {{#if (eq contract.status "ATIVO")}} ... {{/if}}
   */
  Handlebars.registerHelper('eq', (a: unknown, b: unknown): boolean => {
    return a === b;
  });

  /**
   * Adiciona 1 a um número. Útil para contadores em loops.
   * Exemplo: {{addOne @index}}
   */
  Handlebars.registerHelper('addOne', (value: number): number => {
    return value + 1;
  });
}
