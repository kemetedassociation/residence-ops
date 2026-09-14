import { findMeta, INCIDENT_TYPES } from "../lib/constants";
import { cn } from "../lib/utils";

export function IncidentTypeIcon({ type, size = "md", className }) {
  const meta = findMeta(INCIDENT_TYPES, type) || INCIDENT_TYPES[4];
  const Icon = meta.icon;
  const sizes = { sm: "h-7 w-7", md: "h-10 w-10", lg: "h-14 w-14" };
  const iconSizes = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-7 w-7" };

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full", sizes[size], meta.bg, meta.text, className)}>
      <Icon className={iconSizes[size]} />
    </div>
  );
}
