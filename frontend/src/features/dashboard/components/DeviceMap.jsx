import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, useMap } from 'react-leaflet';
import { Maximize2, X } from 'lucide-react';
import { fetchDeviceMap } from '../../../api/dashboard';
import '../../../styles/dash-panels.css';
import 'leaflet/dist/leaflet.css';

const INDIA_CENTER = [22.5, 79.0];
const INDIA_BOUNDS = [
  [6.5, 67.5],
  [37.2, 97.5],
];

/** Spread devices that share the same lat/lng so every pin is visible. */
function spreadOverlapping(devices) {
  const counts = new Map();
  return (devices || []).map((d) => {
    const lat = Number(d.lat);
    const lng = Number(d.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ...d, lat, lng, stackIndex: 0, stackSize: 1 };

    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const idx = counts.get(key) || 0;
    counts.set(key, idx + 1);

    if (idx === 0) {
      return { ...d, lat, lng, stackIndex: 0, stackSize: 1, _key: key };
    }

    const angle = ((idx * 137.5) * Math.PI) / 180;
    const dist = 0.012 * Math.ceil(idx / 8); // ~1.3km steps
    return {
      ...d,
      lat: lat + dist * Math.cos(angle),
      lng: lng + dist * Math.sin(angle),
      stackIndex: idx,
      stackSize: 1,
      _key: key,
      trueLat: lat,
      trueLng: lng,
    };
  }).map((d, _, all) => {
    if (!d._key) return d;
    const size = all.filter((x) => x._key === d._key).length;
    return { ...d, stackSize: size };
  });
}

function formatLastSeen(epoch) {
  const n = Number(epoch);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const ms = n > 1e12 ? n : n * 1000;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

function MapBounds({ devices }) {
  const map = useMap();

  useEffect(() => {
    const points = (devices || [])
      .filter((d) => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)))
      .map((d) => [Number(d.lat), Number(d.lng)]);

    if (!points.length) {
      map.fitBounds(INDIA_BOUNDS, { padding: [24, 24] });
      return;
    }
    map.fitBounds(points, { padding: [40, 40], maxZoom: 8 });
  }, [devices, map]);

  return null;
}

function statusColor(status) {
  switch (status) {
    case 'up':
      return '#22c55e';
    case 'down':
      return '#ef4444';
    case 'onboard':
      return '#a855f7';
    default:
      return '#64748b';
  }
}

function DeviceLeafletMap({ devices, height, onDeviceActivate }) {
  const indiaStyle = useMemo(
    () => ({
      color: '#0369a1',
      weight: 1.6,
      opacity: 0.9,
      fillColor: '#38bdf8',
      fillOpacity: 0.12,
    }),
    []
  );

  const [indiaGeo, setIndiaGeo] = useState(null);
  const plotted = useMemo(() => spreadOverlapping(devices), [devices]);

  useEffect(() => {
    let alive = true;
    fetch('/maps/india.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (alive && geo) setIndiaGeo(geo);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={5}
      style={{ height, width: '100%', borderRadius: 8 }}
      maxBounds={INDIA_BOUNDS}
      maxBoundsViscosity={0.85}
      minZoom={4}
      maxZoom={12}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      {indiaGeo ? (
        <GeoJSON data={indiaGeo} style={indiaStyle} interactive={false} />
      ) : null}
      <MapBounds devices={plotted} />
      {plotted.map((device) => (
        <CircleMarker
          key={device.id}
          center={[Number(device.lat), Number(device.lng)]}
          radius={device.stackSize > 1 ? 8 : 7}
          pathOptions={{
            fillColor: statusColor(device.status),
            color: '#fff',
            weight: 1.5,
            fillOpacity: 0.9,
          }}
          eventHandlers={{
            click: (e) => {
              // India GeoJSON used to steal clicks; force popup + detail panel
              if (e?.originalEvent) {
                e.originalEvent.stopPropagation?.();
              }
              e.target?.openPopup?.();
              onDeviceActivate?.(device.id, device.status);
            },
          }}
        >
          <Popup autoPan maxWidth={280} className="dash-map-leaflet-popup">
            <DevicePopupBody device={device} />
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

function DevicePopupBody({ device }) {
  return (
    <div className="dash-map-popup">
      <strong>{device.hostname || 'Unknown'}</strong>
      <div>
        <span className="dash-map-popup__k">Status</span>
        {(device.status || 'n/a').toUpperCase()}
      </div>
      <div>
        <span className="dash-map-popup__k">Organization</span>
        {device.organization || '—'}
      </div>
      <div>
        <span className="dash-map-popup__k">Branch</span>
        {device.branch || '—'}
      </div>
      <div>
        <span className="dash-map-popup__k">Zone</span>
        {device.zone || '—'}
      </div>
      <div>
        <span className="dash-map-popup__k">Region</span>
        {device.region || '—'}
      </div>
      <div>
        <span className="dash-map-popup__k">Model</span>
        {device.model || '—'}
      </div>
      <div>
        <span className="dash-map-popup__k">CPU</span>
        {device.cpuUsage != null ? `${device.cpuUsage}%` : '—'}
      </div>
      <div>
        <span className="dash-map-popup__k">Memory</span>
        {device.memUsage != null ? `${device.memUsage}%` : '—'}
      </div>
      <div>
        <span className="dash-map-popup__k">Last seen</span>
        {formatLastSeen(device.lastSeen)}
      </div>
      <div>
        <span className="dash-map-popup__k">Coordinates</span>
        {Number(device.trueLat ?? device.lat).toFixed(5)},{' '}
        {Number(device.trueLng ?? device.lng).toFixed(5)}
      </div>
      {device.stackSize > 1 ? (
        <div className="dash-map-popup__note">
          Shared location with {device.stackSize} devices (pin offset for visibility)
        </div>
      ) : null}
    </div>
  );
}

export default function DeviceMap() {
  const [data, setData] = useState({
    devices: [],
    total: 0,
    upCount: 0,
    downCount: 0,
    onboardCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const clickCounts = useRef({});
  const lastClicked = useRef({ id: null, time: 0 });

  const handleDeviceActivate = (deviceId, status) => {
    const now = Date.now();
    if (lastClicked.current.id === deviceId && now - lastClicked.current.time < 2000) {
      clickCounts.current[deviceId] = (clickCounts.current[deviceId] || 0) + 1;
    } else {
      clickCounts.current[deviceId] = 1;
    }
    lastClicked.current = { id: deviceId, time: now };
    if (clickCounts.current[deviceId] >= 3) {
      if (String(status || '').toLowerCase() === 'onboard') {
        navigate('/provisioning/onboard');
      } else {
        navigate(`/live-performance/${deviceId}`);
      }
      clickCounts.current[deviceId] = 0;
    }
  };

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const mapData = await fetchDeviceMap();
        if (!alive) return;
        setData({
          devices: mapData?.devices || [],
          total: mapData?.total ?? mapData?.devices?.length ?? 0,
          upCount: mapData?.upCount ?? 0,
          downCount: mapData?.downCount ?? 0,
          onboardCount: mapData?.onboardCount ?? 0,
        });
        setError('');
      } catch (err) {
        if (!alive) return;
        setError(err.message || 'Failed to load map');
        setData({ devices: [], total: 0, upCount: 0, downCount: 0, onboardCount: 0 });
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 300000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const devices = data.devices || [];
  const uniqueLocations = useMemo(() => {
    const keys = new Set(
      devices
        .filter((d) => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)))
        .map((d) => `${Number(d.lat).toFixed(5)},${Number(d.lng).toFixed(5)}`)
    );
    return keys.size;
  }, [devices]);

  return (
    <section className="dash-panel dash-panel--map">
      <header className="dash-panel__head">
        <div>
          <h3 className="dash-panel__title">Device Locations</h3>
          <p className="dash-panel__meta">
            {loading
              ? 'Loading…'
              : `${data.total} devices${
                  uniqueLocations > 0 && uniqueLocations < data.total
                    ? ` · ${uniqueLocations} locations`
                    : ''
                }`}
          </p>
        </div>
        <div className="dash-panel__head-actions">
          <button
            type="button"
            className="dash-map-legend dash-map-legend--up dash-map-legend--link"
            onClick={() => navigate('/live-performance?status=up')}
            title="View up devices"
          >
            Up {data.upCount}
          </button>
          <button
            type="button"
            className="dash-map-legend dash-map-legend--down dash-map-legend--link"
            onClick={() => navigate('/live-performance?status=down')}
            title="View down devices"
          >
            Down {data.downCount}
          </button>
          <button
            type="button"
            className="dash-map-legend dash-map-legend--onboard dash-map-legend--link"
            onClick={() => navigate('/provisioning/onboard')}
            title="View onboard devices"
          >
            Onboard {data.onboardCount}
          </button>
          <button
            type="button"
            className="dash-panel__icon-btn"
            onClick={() => setOpen(true)}
            title="Fullscreen map"
            aria-label="Fullscreen map"
            disabled={loading}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </header>

      {error ? <p className="dash-panel__error">{error}</p> : null}

      {loading ? (
        <div className="dash-panel__empty">Loading map…</div>
      ) : devices.length === 0 ? (
        <div className="dash-panel__empty">No devices with coordinates in scope.</div>
      ) : (
        <DeviceLeafletMap
          devices={devices}
          height={220}
          onDeviceActivate={handleDeviceActivate}
        />
      )}

      {open && !loading ? (
        <div className="dash-modal" role="dialog" aria-modal="true" aria-label="Device map fullscreen">
          <button type="button" className="dash-modal__backdrop" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="dash-modal__card dash-modal__card--map">
            <header className="dash-panel__head">
              <div>
                <h3 className="dash-panel__title">Device Locations ({data.total})</h3>
                <p className="dash-panel__meta">
                  {uniqueLocations > 0 && uniqueLocations < data.total
                    ? `${uniqueLocations} unique coordinates — overlapping pins are spread apart`
                    : null}
                </p>
              </div>
              <button
                type="button"
                className="dash-panel__icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close map"
              >
                <X size={16} />
              </button>
            </header>
            <div className="dash-panel__head-actions" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className="dash-map-legend dash-map-legend--up dash-map-legend--link"
                onClick={() => navigate('/live-performance?status=up')}
                title="View up devices"
              >
                Up {data.upCount}
              </button>
              <button
                type="button"
                className="dash-map-legend dash-map-legend--down dash-map-legend--link"
                onClick={() => navigate('/live-performance?status=down')}
                title="View down devices"
              >
                Down {data.downCount}
              </button>
              <button
                type="button"
                className="dash-map-legend dash-map-legend--onboard dash-map-legend--link"
                onClick={() => navigate('/provisioning/onboard')}
                title="View onboard devices"
              >
                Onboard {data.onboardCount}
              </button>
            </div>
            <DeviceLeafletMap
              key="fullscreen-map"
              devices={devices}
              height={560}
              onDeviceActivate={handleDeviceActivate}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
