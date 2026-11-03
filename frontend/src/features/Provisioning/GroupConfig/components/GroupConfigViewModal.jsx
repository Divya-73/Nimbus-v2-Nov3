import React from 'react';
import { X } from 'lucide-react';

function formatTs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return new Date(n * 1000).toLocaleString();
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return value >= 1_000_000_000 ? formatTs(value) : String(value);
  }
  const text = String(value);
  if (/^\d{9,}$/.test(text)) return formatTs(Number(text)) || text;
  return text;
}

function statusLabel(status) {
  if (status === null || status === undefined || status === '') {
    return { label: 'Pending', tone: 'onboard' };
  }
  if (Number(status) === 0) return { label: 'Success', tone: 'up' };
  return { label: displayValue(status), tone: 'down' };
}

export default function GroupConfigViewModal({ title, items = [], loading, error, onClose }) {
  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-label="Group config details">
      <button type="button" className="dl-gui-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--wide">
        <header className="dl-gui-modal__head">
          <div>
            <h3 className="dl-gui-modal__title">{title || 'Activity details'}</h3>
            <p className="dl-gui-modal__sub">Per-device MQTT task status for this group run.</p>
          </div>
          <button type="button" className="dl-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {error ? <p className="dl-error">{error}</p> : null}

        {loading ? (
          <div className="dl-empty">Loading details…</div>
        ) : (
          <div className="dl-table-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Task</th>
                  <th>Type</th>
                  <th>Created</th>
                  <th>Sent</th>
                  <th>Processed</th>
                  <th>Result</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {!items.length ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="dl-empty">No device results yet. Run the activity first.</div>
                    </td>
                  </tr>
                ) : (
                  items.map((row, idx) => {
                    const status = statusLabel(row.status);
                    return (
                      <tr key={row.task_id || `${row.devId}-${idx}`}>
                        <td className="dl-table__strong">{row.hostname || row.devId || '—'}</td>
                        <td className="om-cell-clip">{row.task || '—'}</td>
                        <td>{row.type || '—'}</td>
                        <td>{formatTs(row.created)}</td>
                        <td>{formatTs(row.sent)}</td>
                        <td>{formatTs(row.process)}</td>
                        <td className="dl-cell-wrap">{displayValue(row.result)}</td>
                        <td>
                          <span className={`dl-pill dl-pill--${status.tone}`}>{status.label}</span>
                        </td>
                        <td className="dl-cell-wrap">{row.msg || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
