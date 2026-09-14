import { describe, it, expect } from "vitest";
import { labelFor, variantFor, severityColor, INCIDENT_STATUSES } from "../constants";

describe("constants helpers", () => {
  it("resolves a known status label", () => {
    expect(labelFor(INCIDENT_STATUSES, "resolu")).toBe("Résolu");
  });

  it("falls back to the raw value for an unknown status", () => {
    expect(labelFor(INCIDENT_STATUSES, "inconnu")).toBe("inconnu");
  });

  it("resolves the badge variant for a known status", () => {
    expect(variantFor(INCIDENT_STATUSES, "rejete")).toBe("destructive");
  });

  it("computes severity color by active incident count", () => {
    expect(severityColor(0)).toBe("#10b981");
    expect(severityColor(2)).toBe("#f59e0b");
    expect(severityColor(3)).toBe("#ef4444");
  });
});
