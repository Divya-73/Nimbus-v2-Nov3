import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchRegionByName } from '../../../api/regions';
import { getStoredSessionUser } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import {
  deviceStatusPillClass,
  formatSdwan,
  regionStatusPillClass,
  sdwanPillClass,
} from '../RegionList/utils/statusHelpers';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';

export default function RegionDetail({ sidebarOpen: initialSidebar = true }) {
  const { region: regionParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const regionName = decodeURIComponent(String(regionParam || '').trim());

  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const filterParams = useMemo(
    () => ({
      orgId: searchParams.get('orgId') || undefined,
      zone: searchParams.get('zone') || undefined,
    }),
    [searchParams]
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    setProfile(getStoredSessionUser());
  }, [navigate]);

  const load = async () => {
    if (!regionName) {
      setError('Region name is required');
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchRegionByName(regionName, filterParams);
      setDetail(data);
      setLastUpdated(new Date());
    } catch (err) {
      setDetail(null);
      setError(err.message || 'Failed to load region');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated() || !regionName) return undefined;
    load();
    return undefined;
  }, [regionName, filterParams.orgId, filterParams.zone]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const deviceCount = detail?.deviceCount || { total: 0, up: 0, down: 0, upPercentage: 0 };
  const devices = detail?.devices || [];

  return (
    <div className={`dash-root theme-${theme}${sidebarOpen ? '' : ' sidebar-closed'}`}>
      <Topbar
        onToggle={() => setSidebarOpen((o) => !o)}
        theme={theme}
        onThemeChange={(next) => {
          setStoredTheme(next);
          setTheme(next);
        }}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onLogout={handleLogout}
        sidebarOpen={sidebarOpen}
        profile={profile}
      />

      <Sidebar open={sidebarOpen} theme={theme} onLogout={handleLogout} />

      <div className={`dash-main${sidebarOpen ? ' with-sidebar' : ' sidebar-closed'}`}>
        <main className="dash-content dl-page" aria-label="Region detail">
          <section className="dash-panel dl-filters">
            <header className="dash-panel__head">
              <div>
                <button
                  type="button"
                  className="dl-btn"
                  onClick={() => navigate('/inventory/region-list')}
                  style={{ marginBottom: '0.5rem' }}
                >
                  <ArrowLeft size={14} />
                  Back to regions
                </button>
                <h3 className="dash-panel__title">{regionName || 'Region'}</h3>
                <p className="dash-panel__meta">
                  {deviceCount.total} devices · {deviceCount.up} up · {deviceCount.down} down ·{' '}
                  {deviceCount.upPercentage}% up
                  {detail?.regionStatus ? (
                    <>
                      {' '}
                      ·{' '}
                      <span className={regionStatusPillClass(detail.regionStatus)}>
                        {detail.regionStatus}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </header>
          </section>

          {error ? <p className="dl-error">{error}</p> : null}

          <section className="dash-panel dl-table-panel">
            <header className="dash-panel__head">
              <div>
                <h3 className="dash-panel__title">Devices in region</h3>
                <p className="dash-panel__meta">{devices.length} devices</p>
              </div>
            </header>

            {loading && !detail ? (
              <div className="dl-empty">Loading region…</div>
            ) : (
              <div className="dl-table-scroll">
                <table className="dl-table">
                  <thead>
                    <tr>
                      <th>Hostname</th>
                      <th>Model</th>
                      <th>Organization</th>
                      <th>Branch</th>
                      <th>Zone</th>
                      <th>Status</th>
                      <th>SD-WAN</th>
                      <th>Uptime</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!devices.length ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="dl-empty">No devices in this region</div>
                        </td>
                      </tr>
                    ) : (
                      devices.map((d) => (
                        <tr key={d.id}>
                          <td className="dl-table__strong">{d.hostname || d.sysname}</td>
                          <td>{d.model}</td>
                          <td>{d.orgName}</td>
                          <td>{d.branch}</td>
                          <td>{d.zone}</td>
                          <td>
                            <span className={deviceStatusPillClass(d.status)}>{d.status || '—'}</span>
                          </td>
                          <td>
                            <span className={sdwanPillClass(d.sdwanStatus)}>
                              {formatSdwan(d.sdwanStatus)}
                            </span>
                          </td>
                          <td>{d.uptime || '—'}</td>
                          <td>
                            <div className="dl-row-actions">
                              <button
                                type="button"
                                className="dl-icon-btn"
                                title="View device"
                                aria-label={`View ${d.hostname}`}
                                onClick={() =>
                                  navigate(`/live-performance/${encodeURIComponent(d.id)}`, {
                                    state: {
                                      from: `/inventory/region-list/${encodeURIComponent(regionName)}${
                                        window.location.search || ''
                                      }`,
                                      fromLabel: 'Region',
                                    },
                                  })
                                }
                              >
                                <Eye size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
        <Footer />
      </div>
    </div>
  );
}
