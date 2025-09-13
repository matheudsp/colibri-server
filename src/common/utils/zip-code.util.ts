export function formatZipCode(cep: string): string {
  if (!cep) {
    return '';
  }

  // VERIFICAÇÃO: Se já estiver formatado, retorna imediatamente.
  const formatoRegex = /^\d{5}-\d{3}$/;
  if (formatoRegex.test(cep)) {
    return cep;
  }

  // LIMPEZA: Se não estiver formatado, continua com o processo de limpeza.
  const cepLimpo = cep.replace(/\D/g, '');

  // Garante que o CEP tenha no máximo 8 dígitos
  const cepValido = cepLimpo.substring(0, 8);

  //  FORMATAÇÃO: Aplica a máscara se o resultado tiver 8 dígitos.
  if (cepValido.length === 8) {
    return cepValido.replace(/(\d{5})(\d{3})/, '$1-$2');
  }

  // Retorna o CEP limpo (mas não formatado) se não tiver 8 dígitos
  return cepValido;
}
