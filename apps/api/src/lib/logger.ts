import { pino, type Logger } from 'pino';
import type { Config } from '../config.js';

export const createLogger = (config: Pick<Config, 'LOG_LEVEL' | 'NODE_ENV'>): Logger =>
  pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.code',
        '*.token',
        '*.refresh_token',
      ],
      censor: '[redacted]',
    },
    ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty', options: { singleLine: true } } } : {}),
  });
