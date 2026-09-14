import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";
import { IncidentTypeIcon } from "../IncidentTypeIcon";

describe("StatusBadge", () => {
  it("renders the French label for a status", () => {
    render(<StatusBadge status="en_cours" />);
    expect(screen.getByText("En cours")).toBeInTheDocument();
  });

  it("renders an unrecognized status as-is instead of crashing", () => {
    render(<StatusBadge status="mystere" />);
    expect(screen.getByText("mystere")).toBeInTheDocument();
  });
});

describe("IncidentTypeIcon", () => {
  it("falls back to the default type without throwing on an unknown type", () => {
    const { container } = render(<IncidentTypeIcon type="inconnu" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
