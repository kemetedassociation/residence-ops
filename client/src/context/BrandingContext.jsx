import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const BrandingContext = createContext(null);

const DEFAULTS = {
  displayName: "Résidence Ops",
  logoUrl: null,
  primaryColor: null,
  plan: "standard",
  loaded: false,
};

function hexToHslTriplet(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%`;
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULTS);

  useEffect(() => {
    api
      .get("/residences")
      .then((d) => {
        const residence = d.residences?.[0];
        if (!residence) return;
        setBranding({
          displayName: residence.display_name || residence.name || DEFAULTS.displayName,
          logoUrl: residence.logo_url || null,
          primaryColor: residence.plan === "premium" ? residence.primary_color : null,
          plan: residence.plan || "standard",
          loaded: true,
        });
      })
      .catch(() => setBranding((b) => ({ ...b, loaded: true })));
  }, []);

  useEffect(() => {
    document.title = branding.displayName;
    const triplet = hexToHslTriplet(branding.primaryColor);
    if (triplet) {
      document.documentElement.style.setProperty("--primary", triplet);
      document.documentElement.style.setProperty("--ring", triplet);
      document.documentElement.style.setProperty("--sidebar-primary", triplet);
      document.documentElement.style.setProperty("--sidebar-ring", triplet);
    } else {
      ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"].forEach((prop) =>
        document.documentElement.style.removeProperty(prop)
      );
    }
  }, [branding]);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
