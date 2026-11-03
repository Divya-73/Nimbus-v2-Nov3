import React, { useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { FileSpreadsheet, FileText, Image } from 'lucide-react';
import {
  downloadHealthExcel,
  downloadHealthPdf,
  downloadHealthPng,
} from '../utils/healthExport';

export const CHART_HEIGHT = 260;

export function PerfStat({ label, value }) {
  return (
    <div className="lp-health__stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ChartExportCard({
  title,
  option,
  empty,
  height = CHART_HEIGHT,
  loading = false,
  wide = false,
  exportOpts,
}) {
  const chartRef = useRef(null);
  const canExport = Boolean(option) && !loading && exportOpts;

  return (
    <article className={`lp-sheet lp-health__chart${wide ? ' lp-usage__chart--wide' : ''}${loading ? ' is-loading' : ''}`}>
      <header className="lp-sheet__head lp-health__chart-head">
        <span>{title}</span>
        {exportOpts ? (
          <div className="lp-health__exports">
            <button type="button" className="dl-btn" onClick={() => downloadHealthExcel(exportOpts)} disabled={!canExport}>
              <FileSpreadsheet size={13} />
              Excel
            </button>
            <button type="button" className="dl-btn" onClick={() => downloadHealthPdf({ ...exportOpts, chartRef })} disabled={!canExport}>
              <FileText size={13} />
              PDF
            </button>
            <button type="button" className="dl-btn" onClick={() => downloadHealthPng(chartRef, exportOpts)} disabled={!canExport}>
              <Image size={13} />
              PNG
            </button>
          </div>
        ) : null}
      </header>
      {option ? (
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge
          style={{ height, width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      ) : (
        <div className="dl-empty">{empty || 'No data in this range'}</div>
      )}
    </article>
  );
}
