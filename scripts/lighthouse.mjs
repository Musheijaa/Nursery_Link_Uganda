// Runs Lighthouse (mobile preset: mid-range phone, simulated slow 4G) on one URL in its own
// headless Chrome, saves the HTML report and prints the scores as one line of JSON.
// Plain Node ESM on purpose: Lighthouse doesn't survive Playwright's test transpiler.
//   node scripts/lighthouse.mjs <url> <report.html>
import { writeFileSync } from 'node:fs';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const [url, reportPath] = process.argv.slice(2);
if (!url || !reportPath) throw new Error('usage: node scripts/lighthouse.mjs <url> <report.html>');

const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
try {
  // A warm-up load first, so the measured run sees a warm server (as a real one would be)
  await lighthouse(url, { port: chrome.port, onlyCategories: ['performance'], output: 'json', logLevel: 'error' });
  const result = await lighthouse(url, { port: chrome.port, onlyCategories: ['performance', 'accessibility'], output: 'html', logLevel: 'error' });
  if (!result) throw new Error('Lighthouse returned no result');
  const { lhr, report } = result;
  writeFileSync(reportPath, Array.isArray(report) ? report.join('') : report);
  const failingA11y = (lhr.categories.accessibility?.auditRefs ?? [])
    .map(ref => lhr.audits[ref.id])
    .filter(a => a && a.score !== null && a.score < 1)
    .map(a => a.id);
  const opportunities = Object.values(lhr.audits)
    .filter(a => a.details?.type === 'opportunity' && (a.details.overallSavingsMs ?? 0) > 100)
    .map(a => `${a.id} (${Math.round(a.details.overallSavingsMs)} ms)`);
  console.log(JSON.stringify({
    performance: lhr.categories.performance?.score ?? 0,
    accessibility: lhr.categories.accessibility?.score ?? 0,
    lcpMs: lhr.audits['largest-contentful-paint']?.numericValue ?? null,
    tbtMs: lhr.audits['total-blocking-time']?.numericValue ?? null,
    cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
    lcpElement: lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet ?? null,
    failingA11y,
    opportunities,
  }));
} finally {
  chrome.kill();
}
