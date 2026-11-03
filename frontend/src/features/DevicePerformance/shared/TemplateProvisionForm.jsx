import React, { useEffect, useState } from 'react';
import { previewTemplateProvision, runTemplateProvision } from '../../../api/performance';

function statusLabel(device) {
  if (device?.up) return 'Up';
  const status = String(device?.status || '').trim();
  if (!status || status === 'N/A') return 'Down';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TemplateProvisionForm({
  deviceIds = [],
  refreshKey,
  canManage = false,
  showDeviceList = true,
  onCancel,
  onDone,
}) {
  const [ids, setIds] = useState([]);
  const [preview, setPreview] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [actName, setActName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const idsKey = Array.isArray(deviceIds)
    ? deviceIds.map((id) => String(id || '').trim()).filter(Boolean).join(',')
    : String(deviceIds || '').trim();

  useEffect(() => {
    const nextIds = idsKey ? idsKey.split(',') : [];
    if (!nextIds.length) {
      setIds([]);
      setLoading(false);
      if (!saving && !result) {
        setPreview(null);
        setTemplateId('');
        setActName('');
        setError('Select at least one device');
      }
      return undefined;
    }

    setIds(nextIds);
    let alive = true;
    setPreview(null);
    setTemplateId('');
    setActName('');
    setResult(null);
    setError('');
    setLoading(true);
    (async () => {
      try {
        const next = await previewTemplateProvision(nextIds);
        if (!alive) return;
        setPreview(next);
        const first = next?.templates?.[0]?.id || '';
        setTemplateId(first);
        const name = next?.templates?.[0]?.name;
        if (name) setActName(`Provision ${name}`);
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load templates');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey, idsKey]);

  const templates = preview?.templates || [];
  const devices = preview?.devices || [];
  const selectedTemplate = templates.find((item) => item.id === templateId) || null;
  const target = devices[0] || null;
  const count = devices.length || ids.length;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canManage || saving || loading || result) return;
    const pushIds = ids.length
      ? ids
      : devices.map((device) => String(device?.id || '').trim()).filter(Boolean);
    if (!pushIds.length) {
      setError('Select at least one device');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await runTemplateProvision({
        deviceIds: pushIds,
        templateId,
        actName,
      });
      setResult(next);
      onDone?.(next);
    } catch (err) {
      setError(err.message || 'Failed to provision template');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError('');
  }

  if (loading) return <div className="dl-empty">Loading templates…</div>;

  if (result) {
    return (
      <div className="lp-prov-result">
        <p className="lp-prov-result__lead">
          {result.templateName || 'Template'} pushed to {result.ran || 0} device
          {Number(result.ran) === 1 ? '' : 's'}
          {result.failed ? ` · ${result.failed} skipped or failed` : ''}.
        </p>
        <p className="dash-panel__meta">
          Activity saved in Group Config as {result.actName || result.actId}. Check Task History for MQTT status.
        </p>
        {showDeviceList ? (
          <div className="dl-table-scroll lp-prov-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {(result.results || []).map((row) => (
                  <tr key={row.id}>
                    <td className="dl-table__strong">{row.hostname || row.id}</td>
                    <td>{row.ok ? 'Queued' : row.message || 'Failed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dash-panel__meta">
            {(result.results || [])[0]?.ok
              ? 'Queued on this CPE.'
              : (result.results || [])[0]?.message || 'Push did not complete.'}
          </p>
        )}
        <div className="om-form__actions">
          {onCancel ? (
            <button type="button" className="dl-btn dl-btn--accent" onClick={onCancel}>
              Done
            </button>
          ) : (
            <button type="button" className="dl-btn dl-btn--accent" onClick={handleReset}>
              Push another
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form className="om-form" onSubmit={handleSubmit}>
      {error ? <p className="dl-error om-form__full">{error}</p> : null}

      {!showDeviceList && target ? (
        <p className="dash-panel__meta om-form__full">
          {preview?.model || 'Unknown model'}
          {preview?.org ? ` · ${preview.org}` : ''}
          {` · ${statusLabel(target)}`}
          {target.up ? '' : ' — MQTT push is blocked until this CPE is Up'}
        </p>
      ) : null}

      <label className="dl-field">
        <span className="dl-field__label">Template</span>
        <select
          value={templateId}
          onChange={(e) => {
            const nextId = e.target.value;
            setTemplateId(nextId);
            const next = templates.find((item) => item.id === nextId);
            if (next?.name) setActName(`Provision ${next.name}`);
          }}
          required
          disabled={saving || !templates.length || !canManage}
        >
          {!templates.length ? <option value="">No templates for this org and model</option> : null}
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name || item.file}
              {item.type ? ` (${item.type})` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="dl-field">
        <span className="dl-field__label">Activity name</span>
        <input
          value={actName}
          onChange={(e) => setActName(e.target.value)}
          maxLength={80}
          disabled={saving || !canManage}
          placeholder="Provision routing"
        />
      </label>

      {selectedTemplate?.desc ? (
        <p className="dash-panel__meta lp-prov-desc om-form__full">{selectedTemplate.desc}</p>
      ) : null}

      {showDeviceList ? (
        <div className="lp-prov-devices om-form__full">
          <p className="dl-field__label">
            {count} selected
            {preview?.downCount ? ` · ${preview.downCount} Down will be skipped` : ''}
          </p>
          <div className="dl-table-scroll lp-prov-scroll">
            <table className="dl-table">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Branch</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td className="dl-table__strong">{device.hostname}</td>
                    <td>{device.branch || '—'}</td>
                    <td>{statusLabel(device)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!templates.length ? (
        <p className="dash-panel__meta om-form__full">
          Create a template for this organization and model under Provisioning → Template Creation.
        </p>
      ) : null}

      {!canManage ? (
        <p className="dash-panel__meta om-form__full">You can view templates, but only admins can push them.</p>
      ) : null}

      <div className="om-form__actions om-form__full">
        {onCancel ? (
          <button type="button" className="dl-btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          className="dl-btn dl-btn--accent"
          disabled={!canManage || saving || !templates.length || !templateId}
        >
          {saving
            ? 'Pushing…'
            : count === 1
              ? 'Push to this device'
              : `Push to ${count} devices`}
        </button>
      </div>
    </form>
  );
}
