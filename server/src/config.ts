import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  PAYMENT_MODE: z.enum(['simulated', 'live']).default('simulated'),
  MTN_BASE_URL: z.string().url().default('https://sandbox.momodeveloper.mtn.com'),
  MTN_TARGET_ENVIRONMENT: z.string().default('sandbox'),
  MTN_CURRENCY: z.string().default('EUR'),
  MTN_COLLECTION_SUBSCRIPTION_KEY: z.string().default(''),
  MTN_COLLECTION_API_USER: z.string().default(''),
  MTN_COLLECTION_API_KEY: z.string().default(''),
  MTN_DISBURSEMENT_SUBSCRIPTION_KEY: z.string().default(''),
  MTN_DISBURSEMENT_API_USER: z.string().default(''),
  MTN_DISBURSEMENT_API_KEY: z.string().default(''),
  AIRTEL_BASE_URL: z.string().url().default('https://openapiuat.airtel.africa'),
  AIRTEL_CLIENT_ID: z.string().default(''),
  AIRTEL_CLIENT_SECRET: z.string().default(''),
  AIRTEL_DISBURSEMENT_PIN_ENCRYPTED: z.string().default(''),

  SMS_MODE: z.enum(['console', 'africastalking']).default('console'),
  AT_USERNAME: z.string().default('sandbox'),
  AT_API_KEY: z.string().default(''),
  AT_SENDER_ID: z.string().default(''),

  ADMIN_PHONE: z.string().default(''),
  ADMIN_PASSWORD: z.string().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const config = parsed.data;

if (config.PAYMENT_MODE === 'live') {
  const missing = [
    'MTN_COLLECTION_SUBSCRIPTION_KEY', 'MTN_COLLECTION_API_USER', 'MTN_COLLECTION_API_KEY',
    'MTN_DISBURSEMENT_SUBSCRIPTION_KEY', 'MTN_DISBURSEMENT_API_USER', 'MTN_DISBURSEMENT_API_KEY',
    'AIRTEL_CLIENT_ID', 'AIRTEL_CLIENT_SECRET', 'AIRTEL_DISBURSEMENT_PIN_ENCRYPTED',
  ].filter(key => !config[key as keyof typeof config]);
  if (missing.length) {
    console.error(`PAYMENT_MODE=live but these are not set: ${missing.join(', ')}`);
    process.exit(1);
  }
}

if (config.SMS_MODE === 'africastalking' && !config.AT_API_KEY) {
  console.error('SMS_MODE=africastalking but AT_API_KEY is not set');
  process.exit(1);
}

if (config.NODE_ENV === 'production' && config.PAYMENT_MODE === 'simulated') {
  console.warn('WARNING: running in production with simulated payments');
}

export const isSimulatedPayments = config.PAYMENT_MODE === 'simulated';
/** Returns one-time codes in API responses so the site can be tried without an SMS account. */
export const exposeDevCodes = config.SMS_MODE === 'console' && config.NODE_ENV !== 'production';
