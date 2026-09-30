import { config, isSimulatedPayments } from './config.js';
import { createApp } from './app.js';
import { pool, prepareDatabase } from './db/pool.js';
import { processPendingPayments } from './services/orders.js';

await prepareDatabase();
const app = createApp();
const server = app.listen(config.PORT, () => {
  console.log(`Nursery Link API listening on http://localhost:${config.PORT}`);
  console.log(`  payments: ${isSimulatedPayments ? 'simulated' : 'live (MTN MoMo, Airtel Money)'} · sms: ${config.SMS_MODE}`);
});

// Background work: poll providers for pending payments and expire unpaid orders
let busy = false;
const paymentTimer = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await processPendingPayments();
  } catch (err) {
    console.error('Payment worker error:', err);
  } finally {
    busy = false;
  }
}, 5000);

const cleanupTimer = setInterval(() => {
  pool.query(`DELETE FROM sessions WHERE expires_at < now(); DELETE FROM otp_codes WHERE expires_at < now() - interval '1 day';`)
    .catch(err => console.error('Cleanup failed:', err));
}, 60 * 60 * 1000);

const shutdown = () => {
  clearInterval(paymentTimer);
  clearInterval(cleanupTimer);
  server.close(() => pool.end().then(() => process.exit(0)));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
