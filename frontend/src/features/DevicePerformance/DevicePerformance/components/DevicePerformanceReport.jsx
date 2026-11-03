import React, { useMemo, useState } from 'react';
import { Check, FileDown, FileSpreadsheet } from 'lucide-react';
import { useTimeRange } from '../utils/chartTime';
import TimeRangeToolbar from './TimeRangeToolbar';
import {
  collectDeviceReport,
  DEFAULT_REPORT_SECTIONS,
  downloadDeviceReportExcel,
  REPORT_SECTIONS,
} from '../utils/deviceReport';
import { downloadDeviceReportPdf } from '../utils/deviceReportPdf';

export default function DevicePerformanceReport({ device, deviceId }) {
  const {
    preset,
    range,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    rangeError,
    applyPreset,
    applyRange,
    presetLabel,
  } = useTimeRange('24h');

  const [selected, setSelected] = useState(() => new Set(DEFAULT_REPORT_SECTIONS));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [lastKind, setLastKind] = useState('');

  const selectedIds = useMemo(() => REPORT_SECTIONS.map((s) => s.id).filter((id) => selected.has(id)), [selected]);
  const canGenerate = selectedIds.length > 0 && !busy && Boolean(range?.from && range?.to);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(REPORT_SECTIONS.map((s) => s.id)));
  const selectDefault = () => setSelected(new Set(DEFAULT_REPORT_SECTIONS));
  const selectNone = () => setSelected(new Set());

  const run = async (kind) => {
    if (!canGenerate) return;
    setBusy(kind);
    setError('');
    setLastKind('');
    try {
      const report = await collectDeviceReport({
        device,
        deviceId,
        range,
        selected: selectedIds,
      });
      if (kind === 'excel') downloadDeviceReportExcel(report);
      else downloadDeviceReportPdf(report);
      setLastKind(kind);
    } catch (err) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="lp-health">
      <TimeRangeToolbar
        info={(
          <>
            Build a branded PDF for <strong>{device?.hostname || deviceId}</strong> over the {presetLabel}.
            Selected sections include the same charts as the live tabs, plus summary tables. Excel is the data workbook.
          </>
        )}
        extra={(
          <div className="lp-report__actions">
            <button type="button" className="dl-btn" onClick={selectAll} disabled={Boolean(busy)}>
              All sections
            </button>
            <button type="button" className="dl-btn" onClick={selectDefault} disabled={Boolean(busy)}>
              Default
            </button>
            <button type="button" className="dl-btn" onClick={selectNone} disabled={Boolean(busy)}>
              Clear
            </button>
          </div>
        )}
        rangeAriaLabel="Report time range"
        preset={preset}
        applyPreset={applyPreset}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        applyRange={applyRange}
        rangeError={rangeError}
        loading={Boolean(busy)}
      />

      {error ? <p className="dl-error">{error}</p> : null}

      <section className="dash-panel">
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Report sections</h3>
            <p className="dash-panel__meta">
              {selectedIds.length} selected · {device?.hostname || deviceId}
            </p>
          </div>
          <div className="dl-export-actions">
            <button
              type="button"
              className="dl-export-btn dl-export-btn--excel"
              onClick={() => run('excel')}
              disabled={!canGenerate}
              title={canGenerate ? 'Generate Excel report' : 'Select at least one section'}
            >
              <FileSpreadsheet size={14} />
              {busy === 'excel' ? 'Generating…' : 'Excel report'}
            </button>
            <button
              type="button"
              className="dl-export-btn dl-export-btn--pdf"
              onClick={() => run('pdf')}
              disabled={!canGenerate}
              title={canGenerate ? 'Generate PDF report' : 'Select at least one section'}
            >
              <FileDown size={14} />
              {busy === 'pdf' ? 'Rendering charts…' : 'PDF report'}
            </button>
          </div>
        </header>

        <div className="lp-report__options" role="group" aria-label="Report sections">
          {REPORT_SECTIONS.map((item) => {
            const on = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`lp-report__option${on ? ' is-on' : ''}`}
                onClick={() => toggle(item.id)}
                disabled={Boolean(busy)}
                aria-pressed={on}
              >
                <span className={`lp-report__check${on ? ' is-on' : ''}`} aria-hidden>
                  {on ? <Check size={12} /> : null}
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {lastKind ? (
          <p className="lp-health__info lp-report__done">
            {lastKind === 'excel' ? 'Excel' : 'PDF'} report downloaded for {device?.hostname || deviceId}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
