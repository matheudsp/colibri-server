import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. Opções do teste: Simula um aumento gradual de carga
export const options = {
  stages: [
    { duration: '2m', target: 200 }, // Rampa para 200 usuários em 2 minutos
    { duration: '3m', target: 200 }, // Mantém
    { duration: '2m', target: 500 }, // Rampa para 500
    { duration: '3m', target: 500 }, // Mantém
    { duration: '2m', target: 0 },   // Recuperação
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% das requisições devem ser < 500ms
    http_req_failed: ['rate<0.01'],   // A taxa de falha deve ser menor que 1%
  },
};

// Variáveis globais para armazenar os dados de autenticação
let authToken;

// 2. Função de Setup: Executada uma vez antes do início dos testes
export function setup() {
  const loginPayload = JSON.stringify({
    email: __ENV.USER_EMAIL,
    password: __ENV.USER_PASSWORD,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  // Faz a requisição de login
  const res = http.post(`${__ENV.BASE_URL}/api/v1/auth/login`, loginPayload, params);

  // Verifica se o login foi bem-sucedido e extrai o cookie
  check(res, {
    'login successful': (r) => r.status === 200,
    'cookie is present': (r) => r.headers['Set-Cookie'] !== undefined,
  });

  // Extrai o valor do cookie 'accessToken' da resposta
  const cookieHeader = res.headers['Set-Cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/accessToken=([^;]+)/);
    if (match) {
      authToken = match[1];
    }
  }

  if (!authToken) {
    throw new Error('Falha ao obter o accessToken do cookie de login.');
  }

  // O valor retornado aqui é passado para a função principal
  return { authToken };
}

// 3. Cenário Principal do VU: Executado repetidamente por cada usuário virtual
export default function (data) {
  // Parâmetros para as requisições autenticadas, usando o cookie
  const params = {
    headers: {
      'Cookie': `accessToken=${data.authToken}`,
    },
  };

  // Acessa a rota de listagem de propriedades do usuário
  const res = http.get(`${__ENV.BASE_URL}/api/v1/properties`, params);

  // Verifica se a requisição foi bem-sucedida
  check(res, {
    'properties listed successfully': (r) => r.status === 200,
  });

  sleep(1); // Espera 1 segundo entre as requisições de cada VU
}