import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BellRing,
  Box,
  Building2,
  ClipboardList,
  FileCode2,
  FileText,
  FolderCog,
  Globe,
  Hammer,
  LayoutDashboard,
  LogIn,
  MapPin,
  Package,
  Power,
  Satellite,
  Settings,
  SlidersHorizontal,
  Store,
  Trash2,
  Users,
  UsersRound,
  Wrench,
  Zap,
} from 'lucide-react';
import '../../../styles/sidebar.css';

/** Colored nav icons */
function ic(Icon, color, size = 17) {
  return <Icon size={size} color={color} strokeWidth={2} aria-hidden />;
}

const C = {
  dash: '#0a5b47',
  inv: '#d97706',
  org: '#2563eb',
  branch: '#7c3aed',
  zone: '#0891b2',
  region: '#db2777',
  onboard: '#0d9488',
  model: '#ea580c',
  zap: '#eab308',
  mgmt: '#475569',
  users: '#2563eb',
  settings: '#64748b',
  logs: '#0f766e',
  file: '#6366f1',
  trash: '#e11d48',
  login: '#059669',
  bell: '#dc2626',
  prov: '#b45309',
  group: '#8b5cf6',
  template: '#0f766e',
};

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: ic(LayoutDashboard, C.dash),
    to: '/dashboard',
    submenu: null,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: ic(Package, C.inv),
    submenu: [
      { id: 'org-list', label: 'Organization List', icon: ic(Building2, C.org, 15), to: '/inventory/org-list' },
      { id: 'branch-list', label: 'Branch List', icon: ic(Store, C.branch, 15), to: '/branches' },
      { id: 'zone-list', label: 'Zone List', icon: ic(Globe, C.zone, 15), to: '/inventory/zone-list' },
      { id: 'region-list', label: 'Region List', icon: ic(MapPin, C.region, 15), to: '/inventory/region-list' },
      { id: 'model-list', label: 'Model List', icon: ic(Box, C.model, 15), to: '/inventory/models' },
    ],
  },
  {
    id: 'live-perf',
    label: 'Device Performance',
    icon: ic(Zap, C.zap),
    to: '/live-performance',
    submenu: null,
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: ic(BellRing, C.bell),
    submenu: [
      {
        id: 'alarm-config',
        label: 'Alarm Configuration',
        icon: ic(SlidersHorizontal, C.settings, 15),
        to: '/alarm-configuration',
      },
      {
        id: 'alarm-mgmt',
        label: 'Alarm Management',
        icon: ic(ClipboardList, C.bell, 15),
        to: '/alarm-management',
      },
    ],
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: ic(FolderCog, C.logs),
    submenu: [
      {
        id: 'user-log',
        label: 'User Specific Log',
        icon: ic(FileText, C.file, 15),
        to: '/log-management/user-logs',
      },
      {
        id: 'dev-del-log',
        label: 'Device Deletion Log',
        icon: ic(Trash2, C.trash, 15),
        to: '/log-management/device-deletion-logs',
      },
      {
        id: 'login-log',
        label: 'Login Log',
        icon: ic(LogIn, C.login, 15),
        to: '/log-management/login-logs',
      },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    icon: ic(Wrench, C.mgmt),
    submenu: [
      { id: 'org-mgmt', label: 'Org–Branch Management', icon: ic(Users, C.users, 15), to: '/inventory/org-crud' },
      {
        id: 'account-mgmt',
        label: 'Account Management',
        icon: ic(Settings, C.settings, 15),
        to: '/account-management',
      },
    ],
  },
  {
    id: 'provisioning',
    label: 'Provisioning',
    icon: ic(Hammer, C.prov),
    submenu: [
      {
        id: 'on-board',
        label: 'On Board',
        icon: ic(Satellite, C.onboard, 15),
        to: '/provisioning/onboard',
      },
      {
        id: 'template-creation',
        label: 'Template Creation',
        icon: ic(FileCode2, C.template, 15),
        to: '/provisioning/template-creation',
      },
      {
        id: 'group-mapping',
        label: 'Group Config',
        icon: ic(UsersRound, C.group, 15),
        to: '/provisioning/group-config',
      },
    ],
  },
];

export default function Sidebar({ open = true, onLogout, theme = 'light' }) {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});
  const [hoverMenu, setHoverMenu] = useState(null);

  const pathMatches = (targetPath) => {
    if (!targetPath) return false;
    const current = location.pathname;
    if (current === targetPath) return true;
    return current.startsWith(`${targetPath}/`);
  };

  const toggleMenu = (menuId) => {
    setExpandedMenus((prev) => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  useEffect(() => {
    const nextExpanded = {};

    menuItems.forEach((item) => {
      if (!item.submenu) return;

      const isMenuActive = item.submenu.some((sub) => {
        if (sub.to && pathMatches(sub.to)) return true;
        if (sub.nested) return sub.nested.some((nested) => nested.to && pathMatches(nested.to));
        return false;
      });

      if (isMenuActive) nextExpanded[item.id] = true;

      item.submenu.forEach((sub) => {
        if (!sub.nested) return;
        if (sub.nested.some((nested) => nested.to && pathMatches(nested.to))) {
          nextExpanded[sub.id] = true;
        }
      });
    });

    setExpandedMenus((prev) => ({ ...prev, ...nextExpanded }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expand on route change only
  }, [location.pathname]);

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
      return;
    }
    window.location.replace('/login');
  };

  return (
    <aside
      className={`app-sidebar ${open ? 'open' : 'closed'} theme-${theme}`}
      aria-hidden={!open}
    >
      <nav className="sidebar-nav" aria-label="Primary">
        {menuItems.map((item) => {
          const showInlineSub = item.submenu && expandedMenus[item.id] && open;
          const showFloating =
            item.submenu && !open && (expandedMenus[item.id] || hoverMenu === item.id);

          const itemActive = item.to
            ? pathMatches(item.to)
            : item.submenu
              ? item.submenu.some((sub) => {
                  if (sub.to && pathMatches(sub.to)) return true;
                  if (sub.nested) {
                    return sub.nested.some((nested) => nested.to && pathMatches(nested.to));
                  }
                  return false;
                })
              : false;

          return (
            <div
              key={item.id}
              className="nav-item-wrapper"
              onMouseEnter={() => !open && setHoverMenu(item.id)}
              onMouseLeave={() => !open && setHoverMenu(null)}
            >
              {item.to && !item.submenu ? (
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive || itemActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ) : (
                <button
                  type="button"
                  className={`nav-item ${item.submenu ? 'has-submenu' : ''}${itemActive ? ' active' : ''}`}
                  onClick={() => (item.submenu ? toggleMenu(item.id) : null)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.submenu ? (
                    <span className={`nav-caret ${expandedMenus[item.id] ? 'open' : ''}`}>›</span>
                  ) : null}
                </button>
              )}

              {showInlineSub ? (
                <div className="submenu">
                  {item.submenu.map((sub) => (
                    <div key={sub.id} className="submenu-item-wrapper">
                      {sub.to ? (
                        <NavLink
                          to={sub.to}
                          className={({ isActive }) => `submenu-item${isActive ? ' active' : ''}`}
                        >
                          <span className="submenu-left">
                            <span className="submenu-icon">{sub.icon}</span>
                            <span className="submenu-label">{sub.label}</span>
                          </span>
                        </NavLink>
                      ) : (
                        <button
                          type="button"
                          className={`submenu-item ${sub.nested ? 'has-nested' : ''}${
                            expandedMenus[sub.id] ? ' active' : ''
                          }`}
                          onClick={() => (sub.nested ? toggleMenu(sub.id) : null)}
                        >
                          <span className="submenu-left">
                            <span className="submenu-icon">{sub.icon}</span>
                            <span className="submenu-label">{sub.label}</span>
                          </span>
                          {sub.nested ? (
                            <span className={`submenu-caret ${expandedMenus[sub.id] ? 'open' : ''}`}>
                              ›
                            </span>
                          ) : null}
                        </button>
                      )}

                      {sub.nested && expandedMenus[sub.id] ? (
                        <div className="nested-menu">
                          {sub.nested.map((nested) =>
                            nested.to ? (
                              <NavLink
                                key={nested.id}
                                to={nested.to}
                                className={({ isActive }) =>
                                  `nested-item${isActive ? ' active' : ''}`
                                }
                              >
                                <span className="nested-icon">{nested.icon}</span>
                                <span className="nested-label">{nested.label}</span>
                              </NavLink>
                            ) : (
                              <button key={nested.id} type="button" className="nested-item">
                                <span className="nested-icon">{nested.icon}</span>
                                <span className="nested-label">{nested.label}</span>
                              </button>
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {showFloating ? (
                <div className="submenu submenu-floating">
                  {item.submenu.map((sub) => (
                    <div key={sub.id} className="submenu-item-wrapper">
                      {sub.to ? (
                        <NavLink
                          to={sub.to}
                          className={({ isActive }) => `submenu-item${isActive ? ' active' : ''}`}
                        >
                          <span className="submenu-left">
                            <span className="submenu-icon">{sub.icon}</span>
                            <span className="submenu-label">{sub.label}</span>
                          </span>
                        </NavLink>
                      ) : (
                        <button
                          type="button"
                          className={`submenu-item ${sub.nested ? 'has-nested' : ''}${
                            expandedMenus[sub.id] ? ' active' : ''
                          }`}
                          onClick={() => (sub.nested ? toggleMenu(sub.id) : null)}
                        >
                          <span className="submenu-left">
                            <span className="submenu-icon">{sub.icon}</span>
                            <span className="submenu-label">{sub.label}</span>
                          </span>
                          {sub.nested ? (
                            <span className={`submenu-caret ${expandedMenus[sub.id] ? 'open' : ''}`}>
                              ›
                            </span>
                          ) : null}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-logout">
        <button type="button" className="logout-btn" onClick={handleLogout} title="Logout">
          <Power size={15} strokeWidth={2} /> Logout
        </button>
      </div>
    </aside>
  );
}
