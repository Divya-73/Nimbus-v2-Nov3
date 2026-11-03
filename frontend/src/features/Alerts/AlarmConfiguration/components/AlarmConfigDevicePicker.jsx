import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { fetchPolicyDevices, fetchPolicyDeviceIds } from '../../../../api/alarmConfiguration';
import { fetchTemplateOrganizations } from '../../../../api/templates';

const PAGE_SIZE = 25;
const SELECTED_PAGE_SIZE = 40;
const EMPTY_IDS = [];

function deviceLabel(device, id) {
  if (!device) return id;
  return device.sysname || id;
}

export default function AlarmConfigDevicePicker({
  selectedIds = EMPTY_IDS,
  onChange,
  lockedIds = EMPTY_IDS,
  disabled = false,
  isSuperAdmin = false,
}) {
  const lockedKey = Array.isArray(lockedIds) ? lockedIds.map(String).filter(Boolean).join(',') : '';
  const selectedKey = Array.isArray(selectedIds)
    ? selectedIds.map(String).filter(Boolean).join(',')
    : '';

  const lockedSet = useMemo(
    () => new Set(lockedKey ? lockedKey.split(',') : []),
    [lockedKey]
  );
  const selectedSet = useMemo(
    () => new Set(selectedKey ? selectedKey.split(',') : []),
    [selectedKey]
  );

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [model, setModel] = useState('');
  const [orgId, setOrgId] = useState('');
  const [page, setPage] = useState(1);
  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(0);
  const [models, setModels] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(() => new Map());
  const [selectedQuery, setSelectedQuery] = useState('');
  const [selectedPage, setSelectedPage] = useState(1);
  const [selectingAll, setSelectingAll] = useState(false);

  const searchTimer = useRef(null);
  const browseReq = useRef(0);
  const resolvedRef = useRef(new Set());

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    let cancelled = false;
    fetchTemplateOrganizations()
      .then((rows) => {
        if (!cancelled) setOrgs(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const remember = useCallback((rows = []) => {
    if (!rows.length) return;
    setMeta((prev) => {
      const next = new Map(prev);
      for (const row of rows) {
        if (row?.id) {
          next.set(String(row.id), row);
          resolvedRef.current.add(String(row.id));
        }
      }
      return next;
    });
  }, []);

  const loadBrowse = useCallback(async () => {
    const req = browseReq.current + 1;
    browseReq.current = req;
    setLoading(true);
    setError('');
    try {
      const data = await fetchPolicyDevices({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        model: model || undefined,
        orgId: isSuperAdmin ? orgId || undefined : undefined,
      });
      if (req !== browseReq.current) return;
      setDevices(data.devices || []);
      setTotal(data.total || 0);
      remember(data.devices || []);
    } catch (err) {
      if (req !== browseReq.current) return;
      setDevices([]);
      setTotal(0);
      setError(err.message || 'Failed to load devices');
    } finally {
      if (req === browseReq.current) setLoading(false);
    }
  }, [debouncedSearch, isSuperAdmin, model, orgId, page, remember]);

  useEffect(() => {
    loadBrowse();
  }, [loadBrowse]);

  useEffect(() => {
    let cancelled = false;
    fetchPolicyDevices({
      page: 1,
      pageSize: 1,
      orgId: isSuperAdmin ? orgId || undefined : undefined,
    })
      .then((data) => {
        if (!cancelled) setModels(data.models || []);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, orgId]);

  const selectedRows = useMemo(() => {
    const term = selectedQuery.trim().toLowerCase();
    const rows = Array.from(selectedSet).map((id) => {
      const device = meta.get(id);
      return {
        id,
        sysname: device?.sysname || '',
        model: device?.model || '',
        label: deviceLabel(device, id),
        locked: lockedSet.has(id),
      };
    });
    const filtered = term
      ? rows.filter((row) => `${row.label} ${row.model} ${row.id}`.toLowerCase().includes(term))
      : rows;
    return filtered.sort((a, b) => a.label.localeCompare(b.label));
  }, [lockedSet, meta, selectedQuery, selectedSet]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(selectedRows.length / SELECTED_PAGE_SIZE));
    if (selectedPage > maxPage) setSelectedPage(maxPage);
  }, [selectedPage, selectedRows.length]);

  const pagedSelected = useMemo(() => {
    const start = (selectedPage - 1) * SELECTED_PAGE_SIZE;
    return selectedRows.slice(start, start + SELECTED_PAGE_SIZE);
  }, [selectedPage, selectedRows]);

  useEffect(() => {
    const missing = pagedSelected
      .map((row) => row.id)
      .filter((id) => !resolvedRef.current.has(id));
    if (!missing.length) return undefined;
    missing.forEach((id) => resolvedRef.current.add(id));
    let cancelled = false;
    fetchPolicyDevices({ ids: missing, page: 1, pageSize: 1 })
      .then((data) => {
        if (!cancelled) remember(data.selected || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pagedSelected, remember]);

  const browsePages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedPages = Math.max(1, Math.ceil(selectedRows.length / SELECTED_PAGE_SIZE));
  const pageIds = devices.map((device) => String(device.id));
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));

  function emit(nextSet) {
    lockedSet.forEach((id) => nextSet.add(id));
    onChange?.(Array.from(nextSet));
  }

  function toggle(id) {
    const key = String(id);
    if (disabled) return;
    if (lockedSet.has(key) && selectedSet.has(key)) return;
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    emit(next);
  }

  function selectPage() {
    const next = new Set(selectedSet);
    if (pageAllSelected) {
      pageIds.forEach((id) => {
        if (!lockedSet.has(id)) next.delete(id);
      });
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    emit(next);
  }

  async function selectAllMatching() {
    if (disabled || selectingAll || !total) return;
    setSelectingAll(true);
    setError('');
    try {
      const data = await fetchPolicyDeviceIds({
        search: debouncedSearch || undefined,
        model: model || undefined,
        orgId: isSuperAdmin ? orgId || undefined : undefined,
      });
      const next = new Set(selectedSet);
      (data.ids || []).forEach((id) => next.add(String(id)));
      emit(next);
      if (data.truncated) {
        setError(
          `Selected the first ${data.ids.length.toLocaleString()} of ${data.total.toLocaleString()} matching devices. Narrow the filters to include the rest.`
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to select all matching devices');
    } finally {
      setSelectingAll(false);
    }
  }

  function clearSelected() {
    emit(new Set());
  }

  return (
    <div className="ac-picker">
      <div className={`ac-picker__toolbar${isSuperAdmin ? ' ac-picker__toolbar--org' : ''}`}>
        <label className="dl-field ac-picker__search">
          <span className="dl-field__label">Find a device</span>
          <span className="dl-field__control">
            <Search size={14} className="dl-field__icon" />
            <input
              type="search"
              value={search}
              disabled={disabled}
              placeholder="Hostname, model, or id"
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </label>
        {isSuperAdmin ? (
          <label className="dl-field">
            <span className="dl-field__label">Organization</span>
            <select
              value={orgId}
              disabled={disabled}
              onChange={(e) => {
                setOrgId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All organizations</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name || org.org_name || org.id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="dl-field">
          <span className="dl-field__label">Model</span>
          <select
            value={model}
            disabled={disabled}
            onChange={(e) => {
              setModel(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All models</option>
            {models.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="dash-panel__meta ac-picker__hint">
        {loading
          ? 'Loading devices…'
          : `Showing ${devices.length.toLocaleString()} of ${total.toLocaleString()} matching · ${selectedSet.size.toLocaleString()} selected. Search to find a CPE — this list never loads thousands at once.`}
      </p>
      {error ? <p className="dl-error">{error}</p> : null}

      <div className="ac-picker__split">
        <div className="ac-picker__pane">
          <div className="ac-device-head">
            <h4 className="ac-card__title">Available</h4>
            <div className="ac-device-actions">
              <button
                type="button"
                className="dl-btn"
                disabled={disabled || !pageIds.length}
                onClick={selectPage}
              >
                {pageAllSelected ? 'Clear this page' : 'Select this page'}
              </button>
              <button
                type="button"
                className="dl-btn dl-btn--accent"
                disabled={disabled || selectingAll || !total}
                onClick={selectAllMatching}
              >
                {selectingAll ? 'Selecting…' : `Select all (${total.toLocaleString()})`}
              </button>
            </div>
          </div>
          <div className="dl-table-scroll ac-picker__table">
            <table className="dl-table">
              <thead>
                <tr>
                  <th className="tpl-th-check" aria-label="Select" />
                  <th>Hostname</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {loading && !devices.length ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="dl-empty">Loading assigned devices…</div>
                    </td>
                  </tr>
                ) : !devices.length ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="dl-empty">No devices match these filters</div>
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => {
                    const id = String(device.id);
                    const checked = selectedSet.has(id);
                    const locked = lockedSet.has(id);
                    return (
                      <tr
                        key={id}
                        className={checked ? 'tpl-row--selected' : undefined}
                        onClick={() => {
                          if (!disabled && !locked) toggle(id);
                        }}
                      >
                        <td className="tpl-th-check" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="tpl-check-input"
                            checked={checked}
                            disabled={disabled || locked}
                            onChange={() => toggle(id)}
                            aria-label={`Select ${device.sysname || id}`}
                          />
                        </td>
                        <td className="dl-table__strong">{device.sysname || id}</td>
                        <td>
                          <code className="tpl-code">{device.model || '—'}</code>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="dl-pagination">
            <span>
              Page {page} / {browsePages}
            </span>
            <div className="dl-pagination__btns">
              <button
                type="button"
                className="dl-btn"
                disabled={page <= 1 || loading || disabled}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="dl-btn"
                disabled={page >= browsePages || loading || disabled}
                onClick={() => setPage((n) => n + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="ac-picker__pane">
          <div className="ac-device-head">
            <h4 className="ac-card__title">Selected ({selectedSet.size.toLocaleString()})</h4>
            <button
              type="button"
              className="dl-btn"
              disabled={disabled || selectedSet.size <= lockedSet.size}
              onClick={clearSelected}
            >
              Clear
            </button>
          </div>
          <label className="dl-field ac-picker__search">
            <span className="dl-field__label">Search selected</span>
            <input
              type="search"
              value={selectedQuery}
              disabled={disabled}
              placeholder="Filter selected devices"
              onChange={(e) => {
                setSelectedQuery(e.target.value);
                setSelectedPage(1);
              }}
            />
          </label>
          <div className="dl-table-scroll ac-picker__table">
            {!selectedRows.length ? (
              <div className="dl-empty">No devices selected yet</div>
            ) : (
              <ul className="ac-selected-list">
                {pagedSelected.map((row) => (
                  <li key={row.id}>
                    <div>
                      <div className="ac-device-option__name">{row.label}</div>
                      <div className="ac-device-option__meta">
                        {row.model || '—'}
                        {row.locked ? ' · required' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="dl-btn"
                      disabled={disabled || row.locked}
                      onClick={() => toggle(row.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedRows.length > SELECTED_PAGE_SIZE ? (
            <div className="dl-pagination">
              <span>
                Page {selectedPage} / {selectedPages}
              </span>
              <div className="dl-pagination__btns">
                <button
                  type="button"
                  className="dl-btn"
                  disabled={selectedPage <= 1 || disabled}
                  onClick={() => setSelectedPage((n) => Math.max(1, n - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="dl-btn"
                  disabled={selectedPage >= selectedPages || disabled}
                  onClick={() => setSelectedPage((n) => n + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
