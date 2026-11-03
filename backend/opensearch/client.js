import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import { Client } from '@opensearch-project/opensearch';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: path.join(root, '.env') });

function req(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// Host should match cert SAN when rejectUnauthorized is true (e.g. nimbus.systrome.com)
export const client = new Client({
  node: `${req('OPENSEARCH_PROTOCOL')}://${req('OPENSEARCH_HOST')}:${req('OPENSEARCH_PORT')}`,
  // Fail fast so one slow query does not block every API route (frontend axios timeout is 15s)
  requestTimeout: Number(process.env.OPENSEARCH_REQUEST_TIMEOUT_MS) || 12000,
  auth: {
    username: req('OPENSEARCH_USERNAME'),
    password: req('OPENSEARCH_PASSWORD'),
  },
  ssl: {
    ca: fs.existsSync(path.join(root, 'cert', 'ahES.crt'))
      ? fs.readFileSync(path.join(root, 'cert', 'ahES.crt'))
      : undefined,
    rejectUnauthorized: process.env.OPENSEARCH_SSL_REJECT_UNAUTHORIZED !== 'false',
  },
});

export async function testConnection() {
  try {
    const { body } = await client.cluster.health();
    console.log('Connected to OpenSearch');
    console.log(`  Cluster: ${body.cluster_name}`);
    console.log(`  Status:  ${body.status}`);
    console.log(`  Nodes:   ${body.number_of_nodes}`);
    return true;
  } catch (err) {
    console.error('OpenSearch connection failed:', err.message);
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  testConnection().then((ok) => process.exit(ok ? 0 : 1));
}
