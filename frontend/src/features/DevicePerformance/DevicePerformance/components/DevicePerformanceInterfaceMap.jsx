import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDeviceInterfaceMap,
  saveDeviceInterfaceMap,
} from '../../../../api/performance';
import { fetchManagedOrgs } from '../../../../api/orgs';
import { fetchManagedBranches } from '../../../../api/branches';

function placeFromData(data) {
  return {
    orgId: String(data?.orgId || '').trim(),
    branchId: String(data?.branchId || '').trim(),
    zone: String(data?.zone || '').trim(),
    region: String(data?.region || '').trim(),
  };
}

export default function DevicePerformanceInterfaceMap({
  deviceId,
  refreshKey,
  canManage = false,
  isSuperAdmin = false,
  lockedOrgId = '',
  lockedBranchId = '',
  profile = null,
}) {
  const [data, setData] = useState(null);
  const [place, setPlace] = useState(placeFromData());
  const [organizations, setOrganizations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadBranchesForOrg = useCallback(async (targetOrgId) => {
    const id = String(targetOrgId || '').trim();
    if (!id) {
      setBranches([]);
      return;
    }
    if (lockedBranchId) {
      setBranches([{ id: lockedBranchId, branch: lockedBranchId }]);
      return;
    }
    setLookupsLoading(true);
    try {
      const result = await fetchManagedBranches({ orgId: id, page: 1, pageSize: 500 });
      setBranches(result.branches || []);
    } catch {
      setBranches([]);
    } finally {
      setLookupsLoading(false);
    }
  }, [lockedBranchId]);

  useEffect(() => {
    if (!canManage) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (isSuperAdmin) {
          const result = await fetchManagedOrgs({ page: 1, pageSize: 500 });
          if (!cancelled) setOrganizations(result.organizations || []);
        } else if (lockedOrgId) {
          if (!cancelled) {
            setOrganizations([
              {
                id: lockedOrgId,
                org_name: profile?.organization || profile?.orgName || lockedOrgId,
              },
            ]);
          }
        }
      } catch {
        if (!cancelled) setOrganizations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManage, isSuperAdmin, lockedOrgId, profile]);

  async function load() {
    if (!deviceId) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchDeviceInterfaceMap(deviceId);
      setData(next);
      const nextPlace = placeFromData(next);
      if (lockedOrgId) nextPlace.orgId = lockedOrgId;
      if (lockedBranchId) nextPlace.branchId = lockedBranchId;
      setPlace(nextPlace);
      if (lockedBranchId) {
        setBranches([{ id: lockedBranchId, branch: next.branch || lockedBranchId }]);
      } else if (nextPlace.orgId) {
        await loadBranchesForOrg(nextPlace.orgId);
      }
    } catch (err) {
      setData(null);
      setPlace(placeFromData());
      setError(err.message || 'Failed to load site config');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return undefined;
  }, [deviceId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const orgOptions = useMemo(() => {
    const list = [...organizations];
    if (place.orgId && !list.some((org) => org.id === place.orgId)) {
      list.unshift({ id: place.orgId, org_name: data?.org || place.orgId });
    }
    return list;
  }, [organizations, place.orgId, data]);

  const branchOptions = useMemo(() => {
    const list = [...branches];
    if (place.branchId && !list.some((br) => br.id === place.branchId)) {
      list.unshift({ id: place.branchId, branch: data?.branch || place.branchId });
    }
    return list;
  }, [branches, place.branchId, data]);

  const savedPlace = placeFromData(data);
  const dirty = JSON.stringify(place) !== JSON.stringify(savedPlace);

  function handleOrgChange(value) {
    setPlace((prev) => ({ ...prev, orgId: value, branchId: lockedBranchId || '' }));
    loadBranchesForOrg(value);
  }

  function handleBranchChange(value) {
    const selected = branchOptions.find((br) => br.id === value);
    setPlace((prev) => ({
      ...prev,
      branchId: value,
      zone: selected?.zone != null && selected.zone !== '' ? String(selected.zone) : prev.zone,
      region: selected?.region != null && selected.region !== '' ? String(selected.region) : prev.region,
    }));
  }

  async function handleSave() {
    if (!canManage) return;
    setSaving(true);
    setError('');
    try {
      const next = await saveDeviceInterfaceMap(deviceId, {
        orgId: place.orgId,
        branchId: place.branchId,
        zone: place.zone,
        region: place.region,
      });
      setData(next);
      setPlace(placeFromData(next));
    } catch (err) {
      setError(err.message || 'Failed to save site config');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lp-imap">
      <section className={`dash-panel dl-table-panel${loading ? ' is-loading' : ''}`}>
        <header className="dash-panel__head">
          <div>
            <h3 className="dash-panel__title">Location</h3>
            <p className="dash-panel__meta">
              Organization, branch, zone, and region for this managed CPE.
            </p>
          </div>
        </header>

        {error ? <p className="dl-error">{error}</p> : null}

        {loading ? (
          <div className="dl-empty">Loading site config…</div>
        ) : (
          <>
            <div className="om-form lp-imap__place">
              <label className="dl-field">
                <span className="dl-field__label">Organization *</span>
                <select
                  value={place.orgId}
                  onChange={(e) => handleOrgChange(e.target.value)}
                  required
                  disabled={saving || !canManage || Boolean(lockedOrgId) || lookupsLoading}
                >
                  <option value="">Select organization</option>
                  {orgOptions.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.org_name || org.org || org.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="dl-field">
                <span className="dl-field__label">Branch *</span>
                <select
                  value={place.branchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  required
                  disabled={saving || !canManage || Boolean(lockedBranchId) || lookupsLoading || !place.orgId}
                >
                  <option value="">Select branch</option>
                  {branchOptions.map((br) => (
                    <option key={br.id} value={br.id}>
                      {br.branch || br.branch_name || br.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="dl-field">
                <span className="dl-field__label">Zone</span>
                <input
                  value={place.zone}
                  onChange={(e) => setPlace((prev) => ({ ...prev, zone: e.target.value }))}
                  maxLength={80}
                  disabled={saving || !canManage}
                />
              </label>

              <label className="dl-field">
                <span className="dl-field__label">Region</span>
                <input
                  value={place.region}
                  onChange={(e) => setPlace((prev) => ({ ...prev, region: e.target.value }))}
                  maxLength={80}
                  disabled={saving || !canManage}
                />
              </label>
            </div>

            {canManage ? (
              <div className="lp-imap__actions">
                <button
                  type="button"
                  className="dl-btn"
                  disabled={saving || !dirty}
                  onClick={() => {
                    const next = placeFromData(data);
                    setPlace(next);
                    if (next.orgId) loadBranchesForOrg(next.orgId);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="dl-btn dl-btn--accent"
                  disabled={saving || !dirty || !place.orgId || !place.branchId}
                  onClick={handleSave}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
