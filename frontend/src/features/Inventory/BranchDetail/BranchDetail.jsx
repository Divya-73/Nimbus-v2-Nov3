import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchBranchById } from '../../../api/branches';
import { getStoredSessionUser } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import {
  branchStatusPillClass,
  deviceStatusPillClass,
  formatSdwan,
  sdwanPillClass,
} from '../BranchList/utils/statusHelpers';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';

export default function BranchDetail({ sidebarOpen: initialSidebar = true }) {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const branchId = decodeURIComponent(String(idParam || '').trim());

  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
    if (!branchId) {
      setError('Branch id is required');
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchBranchById(branchId);
      setDetail(data);
      setLastUpdated(new Date());
    } catch (err) {
      setDetail(null);
      setError(err.message || 'Failed to load branch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated() || !branchId) return undefined;
    load();
    return undefined;
  }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const title = detail?.branch || 'Branch';

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
        <main className="dash-content dl-page" aria-label="Branch detail">
          <section className="dash-panel dl-filters">
            <header className="dash-panel__head">
              <div>
                <button
                  type="button"
                  className="dl-btn"
                  onClick={() => navigate('/branches')}
                  style={{ marginBottom: '0.5rem' }}
                >
                  <ArrowLeft size={14} />
                  Back to branches
                </button>
                <h3 className="dash-panel__title">{title}</h3>
                <p className="dash-panel__meta">
                  {detail?.orgName ? `${detail.orgName} · ` : ''}
                  {detail?.zone && detail.zone !== 'N/A' ? `${detail.zone} · ` : ''}
                  {detail?.region && detail.region !== 'N/A' ? `${detail.region} · ` : ''}
                  {deviceCount.total} devices · {deviceCount.up} up · {deviceCount.down} down ·{' '}
                  {deviceCount.upPercentage}% up
                  {detail?.branchStatus ? (
                    <>
                      {' '}
                      ·{' '}
                      <span className={branchStatusPillClass(detail.branchStatus)}>
                        {detail.branchStatus}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
            </header>

            {detail ? (
              <div className="dl-filters__grid" style={{ marginTop: '0.75rem' }}>
                <div className="dl-field">
                  <span className="dl-field__label">Site ID</span>
                  <span className="dl-field__control">{detail.siteId || '—'}</span>
                </div>
                <div className="dl-field">
                  <span className="dl-field__label">Type</span>
                  <span className="dl-field__control">{detail.branchType || '—'}</span>
                </div>
                <div className="dl-field">
                  <span className="dl-field__label">Outlet</span>
                  <span className="dl-field__control">{detail.outletName || '—'}</span>
                </div>
                <div className="dl-field">
                  <span className="dl-field__label">Address</span>
                  <span className="dl-field__control">{detail.address || '—'}</span>
                </div>
              </div>
            ) : null}
          </section>

          {error ? <p className="dl-error">{error}</p> : null}

          <section className="dash-panel dl-table-panel">
            <header className="dash-panel__head">
              <div>
                <h3 className="dash-panel__title">Devices in branch</h3>
                <p className="dash-panel__meta">{devices.length} devices</p>
              </div>
            </header>

            {loading && !detail ? (
              <div className="dl-empty">Loading branch…</div>
            ) : (
              <div className="dl-table-scroll">
                <table className="dl-table">
                  <thead>
                    <tr>
                      <th>Hostname</th>
                      <th>Model</th>
                      <th>Organization</th>
                      <th>Zone</th>
                      <th>Region</th>
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
                          <div className="dl-empty">No devices in this branch</div>
                        </td>
                      </tr>
                    ) : (
                      devices.map((d) => (
                        <tr key={d.id}>
                          <td className="dl-table__strong">{d.hostname || d.sysname}</td>
                          <td>{d.model}</td>
                          <td>{d.orgName}</td>
                          <td>{d.zone}</td>
                          <td>{d.region}</td>
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
                                      from: `/branches/${encodeURIComponent(branchId)}`,
                                      fromLabel: 'Branch',
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
