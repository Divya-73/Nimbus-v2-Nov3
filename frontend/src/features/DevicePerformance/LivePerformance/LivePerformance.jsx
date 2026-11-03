import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { isAuthenticated, logout } from '../../../api/auth';
import { fetchLivePerformance, fetchPerformanceFilterOptions, deleteAssignedDevice } from '../../../api/performance';
import { openDeviceGui } from '../../../api/devices';
import { getStoredSessionUser, hasRole, ROLES } from '../../../utils/roleManagement';
import { applyTheme, getStoredTheme, setStoredTheme } from '../../../utils/theme';
import Topbar from '../../common/components/Topbar';
import Sidebar from '../../common/components/Sidebar';
import Footer from '../../common/components/Footer';
import LivePerformanceFilters from './components/LivePerformanceFilters';
import LivePerformanceTable from './components/LivePerformanceTable';
import TemplateProvisionModal from './components/TemplateProvisionModal';
import DeviceDeleteModal from './components/DeviceDeleteModal';
import GuiIpPicker, { listDeviceIpv4 } from '../../Inventory/components/GuiIpPicker';
import {
  DEFAULT_VISIBLE_COLUMNS,
  loadVisibleColumns,
  saveVisibleColumns,
} from './utils/columnConfig';
import {
  downloadPerformanceExcel,
  downloadPerformancePdf,
  fetchAllPerformanceForExport,
} from './utils/performanceExport';
import '../../../styles/dashboard.css';
import '../../../styles/dash-panels.css';
import '../../../styles/device-list.css';
import '../../../styles/live-performance.css';
import '../../../styles/org-management.css';

const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZES = [5, 10, 25, 50, 100];

function readFiltersFromParams(params) {
  const sdwan = String(params.get('sdwanStatus') || '')
    .trim()
    .toUpperCase();
  const lan = String(params.get('lanStatus') || '')
    .trim()
    .toUpperCase();
  const lte = String(params.get('lteStatus') || '')
    .trim()
    .toUpperCase();
  const lte1 = String(params.get('lte1Status') || '')
    .trim()
    .toUpperCase();
  const lte2 = String(params.get('lte2Status') || '')
    .trim()
    .toUpperCase();
  const wan = String(params.get('wanStatus') || params.get('wan1Status') || '')
    .trim()
    .toUpperCase();
  const status = String(params.get('status') || '')
    .trim()
    .toLowerCase();

  const linkOk = (v) => ['UP', 'DOWN', 'NA', 'N/A'].includes(v);

  return {
    search: params.get('search') || '',
    orgId: params.get('orgId') || '',
    branchId: params.get('branchId') || '',
    org: params.get('org') || '',
    branch: params.get('branch') || '',
    zone: params.get('zone') || '',
    region: params.get('region') || '',
    model: params.get('model') || '',
    status: ['up', 'down'].includes(status) ? status : '',
    sdwanStatus: ['UP', 'DOWN'].includes(sdwan) ? sdwan : '',
    lanStatus: linkOk(lan) ? (lan === 'N/A' ? 'NA' : lan) : '',
    lteStatus: linkOk(lte) ? (lte === 'N/A' ? 'NA' : lte) : '',
    lte1Status: linkOk(lte1) ? (lte1 === 'N/A' ? 'NA' : lte1) : '',
    lte2Status: linkOk(lte2) ? (lte2 === 'N/A' ? 'NA' : lte2) : '',
    wanStatus: linkOk(wan) ? (wan === 'N/A' ? 'NA' : wan) : '',
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: PAGE_SIZES.includes(Number(params.get('pageSize')))
      ? Number(params.get('pageSize'))
      : DEFAULT_PAGE_SIZE,
  };
}

function filtersToSearchParams(filters) {
  const next = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (key === 'page' && Number(value) === 1) return;
    if (key === 'pageSize' && Number(value) === DEFAULT_PAGE_SIZE) return;
    if (key === 'org' && filters.orgId) return;
    if (key === 'branch' && filters.branchId) return;
    next.set(key, String(value));
  });
  return next;
}

export default function LivePerformance({ sidebarOpen: initialSidebar = true }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [theme, setTheme] = useState(getStoredTheme);
  const [profile, setProfile] = useState(() => getStoredSessionUser());
  const canManage =
    hasRole(profile, ROLES.SUPER_ADMIN) ||
    hasRole(profile, ROLES.ORG_ADMIN) ||
    hasRole(profile, ROLES.BRANCH_ADMIN);

  const initial = useMemo(() => readFiltersFromParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState(initial.search);
  const [orgId, setOrgId] = useState(initial.orgId);
  const [branchId, setBranchId] = useState(initial.branchId);
  const [orgName, setOrgName] = useState(initial.org);
  const [branchName, setBranchName] = useState(initial.branch);
  const [zone, setZone] = useState(initial.zone);
  const [region, setRegion] = useState(initial.region);
  const [model, setModel] = useState(initial.model);
  const [status, setStatus] = useState(initial.status);
  const [sdwanStatus, setSdwanStatus] = useState(initial.sdwanStatus);
  const [lanStatus, setLanStatus] = useState(initial.lanStatus);
  const [lteStatus, setLteStatus] = useState(initial.lteStatus);
  const [lte1Status, setLte1Status] = useState(initial.lte1Status);
  const [lte2Status, setLte2Status] = useState(initial.lte2Status);
  const [wanStatus, setWanStatus] = useState(initial.wanStatus);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);

  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState({
    organizations: [],
    branches: [],
    zones: [],
    regions: [],
    models: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [openingGuiId, setOpeningGuiId] = useState(null);
  const [guiPicker, setGuiPicker] = useState(null);
  const [guiPickerError, setGuiPickerError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const searchDebounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search);

  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionDeviceIds, setProvisionDeviceIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const next = search.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) {
          setTimeout(() => setPage(1), 0);
        }
        return next;
      });
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      orgId,
      branchId,
      org: orgName,
      branch: branchName,
      zone,
      region,
      model,
      status,
      sdwanStatus,
      lanStatus,
      lteStatus,
      lte1Status,
      lte2Status,
      wanStatus,
      page,
      pageSize,
    }),
    [
      debouncedSearch,
      orgId,
      branchId,
      orgName,
      branchName,
      zone,
      region,
      model,
      status,
      sdwanStatus,
      lanStatus,
      lteStatus,
      lte1Status,
      lte2Status,
      wanStatus,
      page,
      pageSize,
    ]
  );

  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
  }, [filters, setSearchParams]);

  const loadFilters = useCallback(async () => {
    try {
      const data = await fetchPerformanceFilterOptions();
      setFilterOptions({
        organizations: data?.organizations || [],
        branches: data?.branches || [],
        zones: data?.zones || [],
        regions: data?.regions || [],
        models: data?.models || [],
      });
    } catch {
      /* list error surfaces separately */
    }
  }, []);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchLivePerformance({
        page: filters.page,
        pageSize: filters.pageSize,
        search: filters.search || undefined,
        orgId: filters.orgId || undefined,
        branchId: filters.branchId || undefined,
        org: !filters.orgId && filters.org ? filters.org : undefined,
        branch: !filters.branchId && filters.branch ? filters.branch : undefined,
        zone: filters.zone || undefined,
        region: filters.region || undefined,
        model: filters.model || undefined,
        status: filters.status || undefined,
        sdwanStatus: filters.sdwanStatus || undefined,
        lanStatus: filters.lanStatus || undefined,
        lteStatus: filters.lteStatus || undefined,
        lte1Status: filters.lte1Status || undefined,
        lte2Status: filters.lte2Status || undefined,
        wanStatus: filters.wanStatus || undefined,
      });
      setDevices(data?.devices || []);
      setTotal(Number(data?.total) || 0);
      setLastUpdated(new Date());
    } catch (err) {
      setDevices([]);
      setTotal(0);
      setError(err.message || 'Failed to load performance');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    loadFilters();
    return undefined;
  }, [loadFilters]);

  useEffect(() => {
    const orgs = filterOptions.organizations || [];
    const branches = filterOptions.branches || [];

    if (!orgId && orgName && orgs.length) {
      const match = orgs.find(
        (o) => String(o.name).toLowerCase() === String(orgName).toLowerCase()
      );
      if (match?.id) {
        setOrgId(String(match.id));
        setOrgName('');
      }
    }

    if (!branchId && branchName && branches.length) {
      const match = branches.find(
        (b) => String(b.name).toLowerCase() === String(branchName).toLowerCase()
      );
      if (match?.id) {
        setBranchId(String(match.id));
        setBranchName('');
      }
    }
  }, [filterOptions, orgId, orgName, branchId, branchName]);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    loadDevices();
    return undefined;
  }, [loadDevices]);

  const handleFilterChange = (key, value) => {
    if (key === 'orgId') {
      setOrgId(value);
      setOrgName('');
      setBranchId((prev) => {
        if (!prev || !value) return value ? '' : prev;
        const match = (filterOptions.branches || []).find((b) => b.id === prev);
        return match && match.orgId && match.orgId !== value ? '' : prev;
      });
      setBranchName('');
      setPage(1);
      return;
    }

    if (key === 'branchId') {
      setBranchId(value);
      setBranchName('');
      setPage(1);
      return;
    }

    const setters = {
      search: setSearch,
      zone: setZone,
      region: setRegion,
      model: setModel,
      status: setStatus,
      sdwanStatus: setSdwanStatus,
      lanStatus: setLanStatus,
      lteStatus: (next) => {
        setLteStatus(next);
        setLte1Status('');
        setLte2Status('');
      },
      wanStatus: setWanStatus,
    };
    setters[key]?.(value);
    if (key !== 'search') setPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setDebouncedSearch('');
    setOrgId('');
    setBranchId('');
    setOrgName('');
    setBranchName('');
    setZone('');
    setRegion('');
    setModel('');
    setStatus('');
    setSdwanStatus('');
    setLanStatus('');
    setLteStatus('');
    setLte1Status('');
    setLte2Status('');
    setWanStatus('');
    setPage(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadFilters(), loadDevices()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleVisibleColumnsChange = (ids) => {
    setVisibleColumns(ids);
    saveVisibleColumns(ids);
  };

  const handleResetColumns = () => {
    const next = [...DEFAULT_VISIBLE_COLUMNS];
    setVisibleColumns(next);
    saveVisibleColumns(next);
  };

  const exportFilterParams = useMemo(
    () => ({
      search: filters.search || undefined,
      orgId: filters.orgId || undefined,
      branchId: filters.branchId || undefined,
      org: !filters.orgId && filters.org ? filters.org : undefined,
      branch: !filters.branchId && filters.branch ? filters.branch : undefined,
      zone: filters.zone || undefined,
      region: filters.region || undefined,
      model: filters.model || undefined,
      status: filters.status || undefined,
      sdwanStatus: filters.sdwanStatus || undefined,
      lanStatus: filters.lanStatus || undefined,
      lteStatus: filters.lteStatus || undefined,
      lte1Status: filters.lte1Status || undefined,
      lte2Status: filters.lte2Status || undefined,
      wanStatus: filters.wanStatus || undefined,
    }),
    [filters]
  );

  const runExport = async (kind) => {
    if (exporting || total === 0) return;
    setExporting(true);
    setError('');
    try {
      const { devices: allDevices } = await fetchAllPerformanceForExport(exportFilterParams);
      if (!allDevices.length) {
        setError('No devices to export for the current filters');
        return;
      }
      if (kind === 'excel') downloadPerformanceExcel(allDevices);
      else downloadPerformancePdf(allDevices);
    } catch (err) {
      setError(err.message || 'Failed to export live performance');
    } finally {
      setExporting(false);
    }
  };

  const openGuiWithIp = async (deviceId, ip) => {
    if (!deviceId || openingGuiId) return;
    setOpeningGuiId(deviceId);
    setError('');
    setGuiPickerError('');
    try {
      await openDeviceGui(deviceId, { ip });
      setGuiPicker(null);
    } catch (err) {
      const msg = err.message || 'Failed to open device GUI';
      if (guiPicker) setGuiPickerError(msg);
      else setError(msg);
    } finally {
      setOpeningGuiId(null);
    }
  };

  const handleOpenGui = (device) => {
    if (!device?.id || openingGuiId) return;
    const ips = listDeviceIpv4(device);
    if (!ips.length) {
      setError('Device has no IPv4 address for GUI');
      return;
    }
    if (ips.length === 1) {
      openGuiWithIp(device.id, ips[0]);
      return;
    }
    setGuiPickerError('');
    setGuiPicker({ device, ips });
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

  if (String(searchParams.get('status') || '').trim().toLowerCase() === 'onboard') {
    return <Navigate to="/provisioning/onboard" replace />;
  }

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
        <main className="dash-content dl-page" aria-label="Device performance">
          <LivePerformanceFilters
            search={search}
            orgId={orgId}
            branchId={branchId}
            zone={zone}
            region={region}
            model={model}
            status={status}
            sdwanStatus={sdwanStatus}
            lanStatus={lanStatus}
            lteStatus={lteStatus || lte1Status || lte2Status}
            wanStatus={wanStatus}
            filterOptions={filterOptions}
            loading={loading || refreshing}
            onChange={handleFilterChange}
            onRefresh={handleRefresh}
            onClear={handleClear}
          />

          <LivePerformanceTable
            devices={devices}
            loading={loading}
            error={error}
            total={total}
            page={page}
            pageSize={pageSize}
            visibleColumns={visibleColumns}
            columnPickerOpen={columnPickerOpen}
            onColumnPickerToggle={setColumnPickerOpen}
            onVisibleColumnsChange={handleVisibleColumnsChange}
            onResetColumns={handleResetColumns}
            exporting={exporting}
            onExportExcel={() => runExport('excel')}
            onExportPdf={() => runExport('pdf')}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onView={(id) =>
              navigate(`/live-performance/${encodeURIComponent(id)}`, {
                state: {
                  from: `/live-performance${window.location.search || ''}`,
                  fromLabel: 'Live Performance',
                },
              })
            }
            onEditIfaces={(id) =>
              navigate(`/live-performance/${encodeURIComponent(id)}?tab=iface-map`, {
                state: {
                  from: `/live-performance${window.location.search || ''}`,
                  fromLabel: 'Live Performance',
                  tab: 'iface-map',
                },
              })
            }
            canManage={canManage}
            onOpenGui={handleOpenGui}
            openingGuiId={openingGuiId}
            onOpenCli={canManage ? (row) =>
              navigate(`/live-performance/${encodeURIComponent(row.id)}?tab=cli`, {
                state: {
                  from: `/live-performance${window.location.search || ''}`,
                  fromLabel: 'Live Performance',
                  tab: 'cli',
                },
              })
            : undefined}
            onOpenAlarmPolicy={canManage ? (row) =>
              navigate(`/live-performance/${encodeURIComponent(row.id)}?tab=alarm-policy`, {
                state: {
                  from: `/live-performance${window.location.search || ''}`,
                  fromLabel: 'Live Performance',
                  tab: 'alarm-policy',
                },
              })
            : undefined}
            selectedIds={selectedIds}
            onToggleSelect={(id) => {
              const key = String(id);
              setSelectedIds((prev) => (
                prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
              ));
            }}
            onToggleSelectPage={(checked, pageIds) => {
              const keys = (pageIds || []).map(String);
              setSelectedIds((prev) => {
                if (checked) return [...new Set([...prev, ...keys])];
                const drop = new Set(keys);
                return prev.filter((id) => !drop.has(id));
              });
            }}
            onProvision={() => {
              setProvisionDeviceIds(selectedIds.map(String).filter(Boolean));
              setProvisionOpen(true);
            }}
            onDelete={(row) => {
              setDeleteError('');
              setDeleteTarget(row);
            }}
          />

          <TemplateProvisionModal
            open={provisionOpen}
            deviceIds={provisionDeviceIds}
            canManage={canManage}
            onClose={() => {
              setProvisionOpen(false);
              setProvisionDeviceIds([]);
            }}
            onDone={() => setSelectedIds([])}
          />

          {deleteTarget ? (
            <DeviceDeleteModal
              device={deleteTarget}
              deleting={deleting}
              error={deleteError}
              onClose={() => {
                if (deleting) return;
                setDeleteTarget(null);
                setDeleteError('');
              }}
              onConfirm={async () => {
                if (!deleteTarget?.id) return;
                setDeleting(true);
                setDeleteError('');
                try {
                  await deleteAssignedDevice(deleteTarget.id);
                  setSelectedIds((prev) => prev.filter((id) => id !== String(deleteTarget.id)));
                  setDeleteTarget(null);
                  await loadDevices();
                } catch (err) {
                  setDeleteError(err.message || 'Failed to delete device');
                } finally {
                  setDeleting(false);
                }
              }}
            />
          ) : null}

          <GuiIpPicker
            open={Boolean(guiPicker)}
            hostname={guiPicker?.device?.hostname}
            ips={guiPicker?.ips || []}
            busy={Boolean(openingGuiId)}
            error={guiPickerError}
            onClose={() => {
              if (openingGuiId) return;
              setGuiPicker(null);
              setGuiPickerError('');
            }}
            onSelect={(ip) => openGuiWithIp(guiPicker?.device?.id, ip)}
          />
        </main>
        <Footer />
      </div>
    </div>
  );
}
