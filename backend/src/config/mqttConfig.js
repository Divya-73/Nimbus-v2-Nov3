import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mqtt from 'mqtt';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_CONNECT_TIMEOUT_MS = 15000;

let mqttClient = null;
let mqttClientConfigKey = null;

export const MQTT_COMMAND_CATALOG = Object.freeze({
  dmesg: { cmd: 'dmesg', args: '', title: 'Kernel Log' },
  logread: { cmd: 'logread', args: '-l 1000', title: 'System Log' },
  arp: { cmd: 'ip', args: '-4 -o neighbour', title: 'ARP' },
  routes: { cmd: 'ip', args: 'r', title: 'Routes' },
  inter_ip: { cmd: 'ip', args: '-br -4 a', title: 'Interface IP' },
  inter_detail: { cmd: 'ip', args: '-4 -d a', title: 'Interface Details' },
  inter_stat: { cmd: 'ip', args: '-4 -s a', title: 'Interface Stats' },
  ipsec: { cmd: 'swanctl', args: '-l', title: 'IPSEC Status' },
});

function env(name, fallback = '') {
  const value = process.env[name];
  if (value == null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

function resolveFromBackendRoot(input) {
  if (!input) return '';
  return path.isAbsolute(input) ? input : path.resolve(backendRoot, input);
}

function resolveCa(caPath) {
  if (!caPath) return undefined;
  const absolutePath = resolveFromBackendRoot(caPath);
  try {
    return fs.readFileSync(absolutePath);
  } catch (err) {
    const wrapped = new Error(`MQTT CA certificate not found: ${absolutePath}`);
    wrapped.status = 500;
    wrapped.cause = err;
    throw wrapped;
  }
}

export function getMqttConfig() {
  return {
    host: env('MQTT_HOST'),
    port: Number(env('MQTT_PORT', '8883')),
    protocol: env('MQTT_PROTOCOL', 'mqtts'),
    username: env('MQTT_USERNAME'),
    password: env('MQTT_PASSWORD'),
    // Systrome MQTT Root CA (backend/cert/ahNMC.crt)
    caPath: env('MQTT_CA', path.join('cert', 'ahNMC.crt')),
    prefix: env('MQTT_PREFIX'),
    tlsInsecure: env('MQTT_TLS_INSECURE') === 'true',
    qos: Number(env('MQTT_QOS', '2')),
    connectTimeoutMs: Number(env('MQTT_CONNECT_TIMEOUT_MS', String(DEFAULT_CONNECT_TIMEOUT_MS))),
  };
}

export function assertMqttConfig(config = getMqttConfig()) {
  const missing = [];
  if (!config.host) missing.push('MQTT_HOST');
  if (!config.username) missing.push('MQTT_USERNAME');
  if (!config.password) missing.push('MQTT_PASSWORD');
  if (missing.length) {
    const err = new Error(`MQTT configuration is missing: ${missing.join(', ')}`);
    err.status = 500;
    throw err;
  }

  const usesTls = String(config.protocol || '').startsWith('mqtts')
    || String(config.protocol || '') === 'tls';
  if (usesTls && !config.tlsInsecure) {
    if (!config.caPath) {
      const err = new Error('MQTT configuration is missing: MQTT_CA');
      err.status = 500;
      throw err;
    }
    resolveCa(config.caPath);
  }
}

export function getCommandCatalogEntry(key) {
  return MQTT_COMMAND_CATALOG[String(key || '').trim().toLowerCase()] || null;
}

export function listCommandCatalog() {
  return Object.entries(MQTT_COMMAND_CATALOG).map(([key, value]) => ({
    key,
    title: value.title,
    cmd: value.cmd,
    args: value.args,
  }));
}

function getClientCacheKey(config) {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    protocol: config.protocol,
    username: config.username,
    tlsInsecure: config.tlsInsecure,
    caPath: config.caPath,
  });
}

export function getMqttClient(config = getMqttConfig()) {
  assertMqttConfig(config);

  const cacheKey = getClientCacheKey(config);
  if (mqttClient && mqttClientConfigKey === cacheKey) {
    return mqttClient;
  }

  if (mqttClient) {
    mqttClient.removeAllListeners();
    mqttClient.end(true);
  }

  const ca = resolveCa(config.caPath);
  mqttClient = mqtt.connect({
    host: config.host,
    port: config.port,
    protocol: config.protocol,
    username: config.username,
    password: config.password,
    ca,
    rejectUnauthorized: !config.tlsInsecure,
    connectTimeout: config.connectTimeoutMs || DEFAULT_CONNECT_TIMEOUT_MS,
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT client error:', err.message);
  });

  mqttClientConfigKey = cacheKey;
  return mqttClient;
}

export function buildMqttTopic(devId, config = getMqttConfig()) {
  const id = String(devId || '').trim();
  if (!id) {
    const err = new Error('devId is required');
    err.status = 400;
    throw err;
  }
  return config.prefix ? `${config.prefix}/${id}` : id;
}

export async function waitForMqttConnection(client, timeoutMs = DEFAULT_CONNECT_TIMEOUT_MS) {
  if (client.connected) return;

  await new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      client.removeListener('connect', onConnect);
      client.removeListener('error', onError);
      const err = new Error('MQTT connection timeout');
      err.status = 504;
      reject(err);
    }, timeoutMs);

    const onConnect = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      client.removeListener('error', onError);
      resolve();
    };

    const onError = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      client.removeListener('connect', onConnect);
      reject(err);
    };

    client.once('connect', onConnect);
    client.once('error', onError);
  });
}

export async function publishToDevice(devId, payload, config = getMqttConfig()) {
  const client = getMqttClient(config);
  const topic = buildMqttTopic(devId, config);
  await waitForMqttConnection(client, config.connectTimeoutMs);

  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

  await new Promise((resolve, reject) => {
    client.publish(topic, body, { qos: config.qos }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function closeMqttClient() {
  if (!mqttClient) return;
  const current = mqttClient;
  mqttClient = null;
  mqttClientConfigKey = null;
  await new Promise((resolve) => current.end(true, {}, resolve));
}
