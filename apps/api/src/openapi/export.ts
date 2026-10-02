import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { API_VERSION } from '../lib/version.js';
import { buildOpenApiDocument } from './document.js';

/**
 * Writes the OpenAPI document to a file without starting the server, for client generation:
 *   tsx --conditions=source src/openapi/export.ts ../../packages/api-client/openapi.json
 */
const out = process.argv[2];
if (!out) {
  console.error('Usage: export.ts <output.json>');
  process.exit(1);
}
writeFileSync(resolve(out), `${JSON.stringify(buildOpenApiDocument(API_VERSION), null, 2)}\n`);
console.log(`OpenAPI ${API_VERSION} written to ${out}`);
