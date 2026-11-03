import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Cloud, Menu, Moon, RefreshCw, Sun, UserCircle } from 'lucide-react';
import { getRoleLabel } from '../../../utils/roleManagement';
import companylogo from '../../../images/companylogo.png';
import '../../../styles/topbar.css';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', hint: 'Bright workspace', Icon: Sun },
  { id: 'grey', label: 'Grey', hint: 'Neutral charcoal', Icon: Cloud },
  { id: 'dark', label: 'Dark', hint: 'Low-light console', Icon: Moon },
];

export default function Topbar({
  onToggle,
  theme,
  onThemeChange,
  onRefresh,
  onLogout,
  lastUpdated,
  sidebarOpen,
  profile,
  refreshing = false,
}) {
  const navigate = useNavigate();
  const [openProfile, setOpenProfile] = useState(false);
  const [openTheme, setOpenTheme] = useState(false);
  const [elapsedLabel, setElapsedLabel] = useState('');
  const profileRef = useRef(null);
  const themeRef = useRef(null);

  useEffect(() => {
    const formatElapsed = () => {
      if (!lastUpdated) return '';
      const diff = Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) {
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        return `${m}m ${s}s ago`;
      }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      return `${h}h ${m}m ago`;
    };

    setElapsedLabel(formatElapsed());
    if (!lastUpdated) return undefined;
    const id = setInterval(() => setElapsedLabel(formatElapsed()), 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setOpenProfile(false);
      if (themeRef.current && !themeRef.current.contains(e.target)) setOpenTheme(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const currentTheme = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];
  const ThemeTriggerIcon = currentTheme.Icon;

  const handleLogout = async () => {
    setOpenProfile(false);
    if (onLogout) {
      await onLogout();
      return;
    }
    navigate('/login', { replace: true });
  };

  const selectTheme = (id) => {
    onThemeChange?.(id);
    setOpenTheme(false);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <img
          src={companylogo}
          alt="Systrome"
          className="topbar-logo"
          onClick={() => navigate('/dashboard')}
        />
        <button
          type="button"
          className="topbar-icon-btn topbar-hamburger"
          onClick={onToggle}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={sidebarOpen}
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="topbar-center">
        {lastUpdated ? (
          <div className="last-updated-pill">
            <span>Updated: {elapsedLabel}</span>
          </div>
        ) : null}
      </div>

      <div className="topbar-right">
        {onRefresh ? (
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={onRefresh}
            aria-label="Refresh"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'topbar-spin' : undefined} />
          </button>
        ) : null}

        <div className="topbar-theme" ref={themeRef}>
          <button
            type="button"
            className="topbar-theme-btn"
            onClick={() => {
              setOpenTheme((o) => !o);
              setOpenProfile(false);
            }}
            aria-label="Theme menu"
            aria-expanded={openTheme}
            title="Appearance"
          >
            <ThemeTriggerIcon size={15} />
            <span className="topbar-theme-label">{currentTheme.label}</span>
          </button>

          {openTheme ? (
            <div className="topbar-theme-menu" role="menu">
              <p className="topbar-theme-heading">Appearance</p>
              {THEME_OPTIONS.map(({ id, label, hint, Icon }) => {
                const active = theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={`topbar-theme-option${active ? ' active' : ''}`}
                    onClick={() => selectTheme(id)}
                  >
                    <span className="topbar-theme-option-icon">
                      <Icon size={15} />
                    </span>
                    <span className="topbar-theme-option-copy">
                      <span className="topbar-theme-option-label">{label}</span>
                      <span className="topbar-theme-option-hint">{hint}</span>
                    </span>
                    {active ? <Check size={14} className="topbar-theme-check" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="topbar-profile" ref={profileRef}>
          <button
            type="button"
            className="topbar-profile-btn"
            onClick={() => {
              setOpenProfile((o) => !o);
              setOpenTheme(false);
            }}
            aria-label="Profile menu"
            aria-expanded={openProfile}
          >
            <UserCircle className="topbar-profile-avatar" size={22} />
            {profile?.email ? (
              <span className="topbar-profile-email">{profile.email}</span>
            ) : null}
          </button>

          {openProfile ? (
            <div className="topbar-profile-dropdown" role="menu">
              <div className="topbar-profile-header">
                <UserCircle className="topbar-profile-avatar-lg" size={36} />
                <div>
                  {fullName ? <div className="topbar-profile-name">{fullName}</div> : null}
                  {profile?.email ? (
                    <div className="topbar-profile-email-lg">{profile.email}</div>
                  ) : null}
                </div>
              </div>

              <div className="topbar-profile-body">
                {profile?.role != null && profile?.role !== '' ? (
                  <div className="topbar-profile-row">
                    <span className="label">Role</span>
                    <span className="value">{getRoleLabel(profile.role)}</span>
                  </div>
                ) : null}
                {profile?.phone ? (
                  <div className="topbar-profile-row">
                    <span className="label">Phone</span>
                    <span className="value">{profile.phone}</span>
                  </div>
                ) : null}
                {profile?.organization || profile?.orgId ? (
                  <div className="topbar-profile-row">
                    <span className="label">Organization</span>
                    <span className="value">{profile.organization || profile.orgId}</span>
                  </div>
                ) : null}
              </div>

              <button type="button" className="topbar-profile-logout" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
