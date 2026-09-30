import path from 'node:path';

// Tests always run against the separate test database, never development data
process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'));
process.env.NODE_ENV = 'test';
process.env.SMS_MODE = 'console';
process.env.PAYMENT_MODE = 'simulated';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
