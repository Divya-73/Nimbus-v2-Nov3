import React, { useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import { createBranch } from '../../../../api/branches';
import { downloadBranchBulkTemplate, parseBranchBulkFile } from '../utils/branchBulkParse';

export default function BranchBulkUploadModal({ orgId, onClose, onDone }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    setParseError('');
    setResults(null);
    setRows([]);
    setFileName('');
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = await parseBranchBulkFile(file);
      setRows(parsed);
    } catch (err) {
      setParseError(err.message || 'Failed to parse file');
    }
  }

  async function handleUpload() {
    if (!rows.length || !orgId || uploading) return;
    setUploading(true);
    setResults(null);
    const outcome = [];
    setProgress({ done: 0, total: rows.length });

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      try {
        await createBranch({ ...row, orgId });
        outcome.push({ branch: row.branch, ok: true });
      } catch (err) {
        outcome.push({
          branch: row.branch,
          ok: false,
          error: err.message || 'Failed',
        });
      }
      setProgress({ done: i + 1, total: rows.length });
    }

    setResults(outcome);
    setUploading(false);
    const okCount = outcome.filter((r) => r.ok).length;
    if (okCount > 0) onDone?.();
  }

  const okCount = results ? results.filter((r) => r.ok).length : 0;
  const failCount = results ? results.length - okCount : 0;

  return (
    <div className="dl-gui-modal" role="dialog" aria-modal="true" aria-labelledby="bm-bulk-title">
      <button
        type="button"
        className="dl-gui-modal__backdrop"
        aria-label="Close"
        onClick={uploading ? undefined : onClose}
      />
      <div className="dl-gui-modal__card om-modal__card om-modal__card--wide">
        <header className="dl-gui-modal__head">
          <div>
            <h3 id="bm-bulk-title" className="dl-gui-modal__title">
              Bulk upload branches
            </h3>
            <p className="dl-gui-modal__sub">
              Upload a CSV or Excel file to create multiple branches under this organization.
            </p>
          </div>
          <button
            type="button"
            className="dl-icon-btn"
            onClick={onClose}
            aria-label="Close"
            disabled={uploading}
          >
            <X size={16} />
          </button>
        </header>

        <div className="bm-bulk">
          <div className="bm-bulk__actions">
            <button
              type="button"
              className="dl-btn"
              onClick={downloadBranchBulkTemplate}
              disabled={uploading}
            >
              <Download size={14} />
              Download template
            </button>
            <button
              type="button"
              className="dl-btn dl-btn--accent"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} />
              Choose file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              hidden
              onChange={handleFileChange}
            />
          </div>

          {fileName ? (
            <p className="dl-gui-modal__hint">
              Selected: <strong>{fileName}</strong>
              {rows.length ? ` · ${rows.length} valid row(s)` : ''}
            </p>
          ) : (
            <p className="dl-gui-modal__hint">
              Required column: Branch Name. Optional: Site ID, Zone, Region, Address, Phone, Email, etc.
            </p>
          )}

          {parseError ? <p className="dl-error">{parseError}</p> : null}

          {uploading ? (
            <p className="dl-gui-modal__hint">
              Uploading {progress.done} / {progress.total}…
            </p>
          ) : null}

          {results ? (
            <div className="bm-bulk__results">
              <p className="dl-gui-modal__hint">
                Done: <strong>{okCount}</strong> created, <strong>{failCount}</strong> failed
              </p>
              {failCount > 0 ? (
                <ul className="bm-bulk__errors">
                  {results
                    .filter((r) => !r.ok)
                    .slice(0, 8)
                    .map((r) => (
                      <li key={`${r.branch}-${r.error}`}>
                        {r.branch}: {r.error}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="om-form__actions">
            <button type="button" className="dl-btn" onClick={onClose} disabled={uploading}>
              {results ? 'Close' : 'Cancel'}
            </button>
            <button
              type="button"
              className="dl-btn dl-btn--accent"
              onClick={handleUpload}
              disabled={uploading || !rows.length}
            >
              {uploading ? 'Uploading…' : `Upload ${rows.length || ''} branch${rows.length === 1 ? '' : 'es'}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
