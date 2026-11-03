import React, { useEffect, useState } from 'react';

function formatIst(date) {
  return (
    date.toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + ' IST'
  );
}

export function IstClock() {
  const [now, setNow] = useState(() => formatIst(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setNow(formatIst(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time dateTime={new Date().toISOString()} className="tabular-nums font-medium text-slate-600">
      {now}
    </time>
  );
}
