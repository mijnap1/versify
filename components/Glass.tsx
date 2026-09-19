"use client";

import LiquidGlass from "liquid-glass-react";
import { useEffect, useState, type ReactNode } from "react";

export function Glass({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update(); preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return <div className={`glass-shell ${className}`}>
    <LiquidGlass displacementScale={48} blurAmount={0.08} saturation={125} aberrationIntensity={1.2}
      elasticity={reduced ? 0 : 0.12} cornerRadius={100} padding="0" overLight
      style={{ position: "absolute", top: "50%", left: "50%", width: "100%" }}>
      {children}
    </LiquidGlass>
  </div>;
}
