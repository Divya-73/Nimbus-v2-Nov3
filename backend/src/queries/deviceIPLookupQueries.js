import { client } from '../../opensearch/client.js';
import { INDICES } from '../config/databaseConfig.js';

const DEVICE_IP_SOURCE = {
  includes: [
    'devId',
    'sysname',
    'ips',
    'model',
    'org',
    'branch',
    'zone',
    'region',
  ],
};

export async function getDeviceDetailsByIp(ip) {
  const searchIp = String(ip || '').trim();

  if (!searchIp) {
    return null;
  }

  const { body } = await client.search({
    index: INDICES.DEVICES,

    body: {
      size: 1,

      query: {
        term: {
          'ips.keyword': searchIp,
        },
      },

      _source: DEVICE_IP_SOURCE,
    },
  });

  const hit = body.hits?.hits?.[0];

  if (!hit) {
    return null;
  }

  const src = hit._source || {};

  return {
    deviceId: src.devId || hit._id,
    ip: searchIp,

    deviceName: src.sysname || 'N/A',

    branch: src.branch || 'N/A',

    organization: src.org || 'N/A',

    model: src.model || 'N/A',

    zone: src.zone || 'N/A',
    region: src.region || 'N/A',

    ips: src.ips || [],
  };
}