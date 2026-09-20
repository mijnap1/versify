"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pad = (value: number) => String(value).padStart(2, "0");
  const time = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : "--:--";

  return <time className="local-clock" dateTime={now?.toISOString()} aria-label={`Local time ${time}`} title="Your local time">
    <span>{time}</span><span className="clock-seconds" aria-hidden="true">{now ? pad(now.getSeconds()) : "--"}</span>
  </time>;
}
