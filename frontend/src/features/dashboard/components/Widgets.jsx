import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  Cable,
  Earth,
  MapPin,
  Monitor,
  RefreshCw,
  Signal,
  Store,
  Wifi,
} from 'lucide-react';
import '../../../styles/widgets.css';

const ICON = 15;

export default function Widgets({ stats, loading }) {
  const navigate = useNavigate();

  if (loading && !stats) return null;
  if (!stats) return null;

  const device = stats.deviceStatus || { up: 0, down: 0, onboard: 0 };

  const cards = [
    {
      type: 'count',
      key: 'organizations',
      label: 'Organizations',
      value: stats.organizationCount ?? stats.orgCount ?? 0,
      icon: <Building2 size={ICON} strokeWidth={2} />,
      tone: 'neutral',
      to: '/inventory/org-list',
      title: 'View Organization List',
    },
    {
      type: 'count',
      key: 'branches',
      label: 'Branches',
      value: stats.branchCount ?? 0,
      icon: <Store size={ICON} strokeWidth={2} />,
      tone: 'neutral',
      to: '/branches',
      title: 'View Branch List',
    },
    {
      type: 'count',
      key: 'zones',
      label: 'Zones',
      value: stats.zoneCount ?? 0,
      icon: <Earth size={ICON} strokeWidth={2} />,
      tone: 'neutral',
      to: '/inventory/zone-list',
      title: 'View Zone List',
    },
    {
      type: 'count',
      key: 'regions',
      label: 'Regions',
      value: stats.regionCount ?? 0,
      icon: <MapPin size={ICON} strokeWidth={2} />,
      tone: 'neutral',
      to: '/inventory/region-list',
      title: 'View Region List',
    },
    {
      type: 'statusAll',
      key: 'device',
      label: 'Device Status',
      icon: <Monitor size={ICON} strokeWidth={2} />,
      tone: 'neutral',
      data: device,
    },
    {
      type: 'status',
      key: 'lte1',
      label: 'LTE1 Status',
      icon: <Signal size={ICON} strokeWidth={2} />,
      tone: 'neutral',
      data: stats.lte1 || { up: 0, down: 0 },
    },
    {
      type: 'status',
      key: 'lte2',
      label: 'LTE2 Status',
      icon: <Wifi size={ICON} strokeWidth={2} />,
      tone: 'neutral',
      data: stats.lte2 || { up: 0, down: 0 },
    },
    {
      type: 'status',
      key: 'lan',
      label: 'LAN Status',
      icon: <Cable size={ICON} strokeWidth={2} />,
      tone: 'neutral',
      data: stats.lan || { up: 0, down: 0 },
    },
  ];

  const handleDeviceStatusClick = (status) => {
    if (status === 'onboard') {
      navigate('/provisioning/onboard');
      return;
    }
    navigate(`/live-performance?status=${status}`);
  };

  const handleRadioStatusClick = (type, status) => {
    let param = '';
    if (type === 'lan') param = 'lanStatus';
    else if (type === 'lte1') param = 'lte1Status';
    else if (type === 'lte2') param = 'lte2Status';
    navigate(`/live-performance?${param}=${status}`);
  };

  return (
    <section className="widgets-grid" aria-label="Dashboard KPIs">
      {cards.map((card) => {
        const clickable = Boolean(card.to);

        return (
          <article
            key={card.key}
            className={`widget-card widget-card--${card.type}${clickable ? ' widget-card--link' : ''}`}
            onClick={clickable ? () => navigate(card.to) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(card.to);
                    }
                  }
                : undefined
            }
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            title={card.title}
          >
            <div className="widget-card__top">
              <span className={`widget-card__icon widget-card__icon--${card.tone}`}>
                {card.icon}
              </span>
              <span className="widget-card__label">{card.label}</span>
            </div>

            <div className="widget-card__body">
              {card.type === 'count' ? (
                <p className="widget-card__value">{Number(card.value || 0).toLocaleString()}</p>
              ) : null}

              {card.type === 'statusAll' ? (
                <div className="widget-status">
                  <button
                    type="button"
                    className="widget-chip widget-chip--up"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeviceStatusClick('up');
                    }}
                    title="View Up Devices"
                  >
                    <ArrowUpCircle size={14} />
                    <span>{(card.data.up || 0).toLocaleString()}</span>
                  </button>
                  <button
                    type="button"
                    className="widget-chip widget-chip--down"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeviceStatusClick('down');
                    }}
                    title="View Down Devices"
                  >
                    <ArrowDownCircle size={14} />
                    <span>{(card.data.down || 0).toLocaleString()}</span>
                  </button>
                  <button
                    type="button"
                    className="widget-chip widget-chip--onboard"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeviceStatusClick('onboard');
                    }}
                    title="View Onboard Devices"
                  >
                    <RefreshCw size={14} />
                    <span>{(card.data.onboard || 0).toLocaleString()}</span>
                  </button>
                </div>
              ) : null}

              {card.type === 'status' ? (
                <div className="widget-status">
                  <button
                    type="button"
                    className="widget-chip widget-chip--up"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRadioStatusClick(card.key, 'up');
                    }}
                    title={`View Up Devices (${card.label})`}
                  >
                    <ArrowUpCircle size={14} />
                    <span>{(card.data.up || 0).toLocaleString()}</span>
                  </button>
                  <button
                    type="button"
                    className="widget-chip widget-chip--down"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRadioStatusClick(card.key, 'down');
                    }}
                    title={`View Down Devices (${card.label})`}
                  >
                    <ArrowDownCircle size={14} />
                    <span>{(card.data.down || 0).toLocaleString()}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
