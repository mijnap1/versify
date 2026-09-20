"use client";

import { useEffect, useState } from "react";

export function Clock({ hour12 }: { hour12: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pad = (value: number) => String(value).padStart(2, "0");
  const time = now ? `${pad(hour12 ? now.getHours() % 12 || 12 : now.getHours())}:${pad(now.getMinutes())}` : "--:--";

  return <time className="local-clock" dateTime={now?.toISOString()} aria-label={`Local time ${time}${hour12 && now ? now.getHours() < 12 ? " AM" : " PM" : ""}`} title="Your local time">
    <span>{time}</span><span className={`clock-seconds ${hour12 ? "clock-period" : ""}`} aria-hidden="true">{now ? hour12 ? (now.getHours() < 12 ? "AM" : "PM") : pad(now.getSeconds()) : "--"}</span>
  </time>;
}
