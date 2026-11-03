import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { isAlarmCleared } from '../../../../api/alarms';

export default function AlarmClearAction({ alarm, busy = false, onClear }) {
  if (!alarm?.id || isAlarmCleared(alarm.alarmStatus)) return null;

  return (
    <button
      type="button"
      className="dl-icon-btn"
      title="Clear this alarm"
      aria-label={`Clear alarm on ${alarm.hostname || alarm.devId || 'device'}`}
      disabled={busy}
      onClick={() => onClear?.(alarm)}
    >
      <CheckCircle2 size={14} />
    </button>
  );
}
