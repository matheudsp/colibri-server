export const CONFIG = {
  PAGINATION: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  DATABASE: {
    MAX_CONNECTIONS: 10,
    TIMEOUT: 5000,
  },

  APP: {
    ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000'),
  },
} as const;
