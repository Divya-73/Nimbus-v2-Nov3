  import fs from 'fs';
  import path from 'path';
  import https from 'https';
  import { randomUUID } from 'crypto';
  import { fileURLToPath } from 'url';
  import express from 'express';
  import cors from 'cors';
  import morgan from 'morgan';
  import { config as loadEnv } from 'dotenv';
  import { client } from '../opensearch/client.js';
  import authRoutes from './routes/auth.js';
  import dashboardRoutes from './routes/dashboard.js';
  import deviceRoutes from './routes/devices.js';
  import regionRoutes from './routes/regions.js';
  import zoneRoutes from './routes/zones.js';
  import branchRoutes from './routes/branches.js';
  import modelRoutes from './routes/models.js';
  import orgRoutes from './routes/orgs.js';
  import performanceRoutes from './routes/performance.js';
  import deviceHealthRoutes from './routes/deviceHealth.js';
  import trafficRoutes from './routes/traffic.js';
  import interfaceHealthRoutes from './routes/interfaceHealth.js';
  import linkHealthRoutes from './routes/linkHealth.js';
  import dataUsageRoutes from './routes/dataUsage.js';
  import deviceAlarmRoutes from './routes/deviceAlarms.js';
  import deviceLogRoutes from './routes/deviceLogs.js';
  import deviceJobRoutes from './routes/deviceJobs.js';
  import deviceInterfaceMapRoutes from './routes/deviceInterfaceMap.js';
  import deviceDeleteRoutes from './routes/deviceDelete.js';
  import accountRoutes from './routes/accounts.js';
  import loginLogRoutes from './routes/loginLogs.js';
  import userLogRoutes from './routes/userLogs.js';
  import deviceDeletionLogRoutes from './routes/deviceDeletionLogs.js';
  import alarmRoutes from './routes/alarms.js';
  import alarmConfigurationRoutes from './routes/alarmConfiguration.js';
  import templateRoutes from './routes/templates.js';
  import mqttRoutes from './routes/mqtt.js';
  import groupConfigRoutes from './routes/groupConfig.js';
  import onboardRoutes from './routes/onboard.js';
  import { closeMqttClient } from './config/mqttConfig.js';
  import { proxyDeviceGui, rescueGuiRootPaths } from './middleware/deviceGuiProxy.js';
  import { attachDeviceSshProxy } from './middleware/deviceSshProxy.js';
  import { createApiHelmet, isGuiProxyPath } from './middleware/securityHeaders.js';
  //new
  import deviceIpLookupRoutes from './routes/deviceIpLookupRoutes.js';

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, '..');
  loadEnv({ path: path.join(root, '.env') });

  const app = express();
  const PORT = Number(process.env.PORT) || 5001;
  const HOST = process.env.HOST || '0.0.0.0';
  const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';

  app.set('trust proxy', 1);

  const apiHelmet = createApiHelmet();
  app.use((req, res, next) => {
    if (isGuiProxyPath(req.path)) return next();
    return apiHelmet(req, res, next);
  });
  app.use(
    cors({
      origin: (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      credentials: true,
    })
  );
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  /**
   * IMPORTANT: mount GUI proxy BEFORE express.json().
   * LuCI login uses POST /ubus with JSON — if json() consumes the body first,
   * the upstream device receives an empty body → "No related RPC reply".
   */
  app.use('/api/v1/devices/gui-proxy/:token', proxyDeviceGui);

  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    req.id = randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  app.get('/health', async (_req, res) => {
    try {
      const { body } = await client.cluster.health();
      res.json({
        success: true,
        api: 'ok',
        database: {
          connected: true,
          cluster: body.cluster_name,
          status: body.status,
          nodes: body.number_of_nodes,
        },
      });
    } catch (err) {
      res.status(503).json({
        success: false,
        api: 'ok',
        database: { connected: false, error: err.message },
      });
    }
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/devices', deviceRoutes);
  app.use('/api/v1/regions', regionRoutes);
  app.use('/api/v1/zones', zoneRoutes);
  app.use('/api/v1/branches', branchRoutes);
  app.use('/api/v1/models', modelRoutes);
  app.use('/api/v1/orgs', orgRoutes);
  app.use('/api/v1/performance', performanceRoutes);
  app.use('/api/v1/performance/device', deviceHealthRoutes);
  app.use('/api/v1/performance/device', trafficRoutes);
  app.use('/api/v1/performance/device', interfaceHealthRoutes);
  app.use('/api/v1/performance/device', linkHealthRoutes);
  app.use('/api/v1/performance/device', dataUsageRoutes);
  app.use('/api/v1/performance/device', deviceAlarmRoutes);
  app.use('/api/v1/performance/device', deviceLogRoutes);
  app.use('/api/v1/performance/device', deviceJobRoutes);
  app.use('/api/v1/performance/device', deviceInterfaceMapRoutes);
  app.use('/api/v1/performance/device', deviceDeleteRoutes);
  app.use('/api/v1/accounts', accountRoutes);
  app.use('/api/v1/login-logs', loginLogRoutes);
  app.use('/api/v1/user-logs', userLogRoutes);
  app.use('/api/v1/device-deletion-logs', deviceDeletionLogRoutes);
  app.use('/api/v1/alarms', alarmRoutes);
  app.use('/api/v1/alarm-configuration', alarmConfigurationRoutes);
  app.use('/api/v1/templates', templateRoutes);
  app.use('/api/v1/mqtt', mqttRoutes);
  app.use('/api/v1/group-config', groupConfigRoutes);
  app.use('/api/v1/onboard', onboardRoutes);
  //new
  app.use('/api/devices', deviceIpLookupRoutes);
  /** Catch LuCI absolute paths that escaped the /gui-proxy/:token prefix. */
  app.use(rescueGuiRootPaths);

  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found', path: req.path, requestId: req.id });
  });

  app.use((err, req, res, _next) => {
    const message = process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';
    res.status(err.status || 500).json({ success: false, message, requestId: req.id });
  });

  let server;

  async function start() {
    const { body } = await client.cluster.health();
    console.log(`OpenSearch connected (${body.cluster_name}, ${body.status})`);

    const onListen = () => {
      const scheme = ENABLE_HTTPS ? 'https' : 'http';
      console.log(`API listening on ${scheme}://${HOST}:${PORT}`);
    };

    if (ENABLE_HTTPS) {
      const keyPath = path.join(root, 'cert', 'key.pem');
      const certPath = path.join(root, 'cert', 'cert.pem');
      if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        throw new Error('ENABLE_HTTPS=true but cert/key.pem or cert/cert.pem is missing');
      }
      server = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app);
      attachDeviceSshProxy(server);
      server.listen(PORT, HOST, onListen);
    } else {
      server = app.listen(PORT, HOST, onListen);
      attachDeviceSshProxy(server);
    }
  }

  async function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closeMqttClient();
      await client.close();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  start().catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
