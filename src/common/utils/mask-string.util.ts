/**
 * Mascara uma string, revelando um número específico de caracteres.
 *
 * @param value A string a ser mascarada.
 * @param visibleChars O número de caracteres a serem deixados visíveis.
 * @param options Opções de mascaramento.
 * @param options.maskChar O caractere a ser usado para o mascaramento. Padrão: '*'.
 * @param options.position De onde revelar os caracteres ('start' ou 'end'). Padrão: 'end'.
 * @returns A string mascarada ou null.
 */
export function maskString(
  value: string | null | undefined,
  visibleChars: number,
  options: {
    maskChar?: string;
    position?: 'start' | 'end';
  } = {},
): string | null {
  // Define os valores padrão para as opções
  const { maskChar = '*', position = 'end' } = options;

  if (!value) {
    return null;
  }

  const valueLength = value.length;
  if (valueLength <= visibleChars) {
    return value;
  }

  if (position === 'start') {
    const visiblePart = value.slice(0, visibleChars);
    const maskedPart = maskChar.repeat(valueLength - visibleChars);
    return `${visiblePart}${maskedPart}`;
  } else {
    // Padrão 'end'
    const maskedPart = maskChar.repeat(valueLength - visibleChars);
    const visiblePart = value.slice(-visibleChars);
    return `${maskedPart}${visiblePart}`;
  }
}
