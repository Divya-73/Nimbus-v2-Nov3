import { INDICES } from './databaseConfig.js';
import { toEpochSeconds } from './deviceStatusConfig.js';

export const FLOWS_INDEX = INDICES.APPLICATION_DETAILS;

export function resolveTimeRange(from, to) {
  const now = Math.floor(Date.now() / 1000);
  const toTime = toEpochSeconds(to) ?? now;
  const fromTime = toEpochSeconds(from) ?? (toTime - 86400);
  return {
    fromTime,
    toTime,
    fromMs: fromTime * 1000,
    toMs: toTime * 1000,
  };
}

/** Match keyword / plain / phrase `devId` variants on telemetry indices. */
export function deviceIdFilter(deviceId) {
  return {
    bool: {
      should: [
        { term: { 'devId.keyword': deviceId } },
        { term: { devId: deviceId } },
        { match_phrase: { devId: deviceId } },
      ],
      minimum_should_match: 1,
    },
  };
}
