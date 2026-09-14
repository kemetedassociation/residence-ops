import { Badge } from "./ui/badge";
import { INCIDENT_STATUSES, labelFor, variantFor } from "../lib/constants";

export function StatusBadge({ status, className }) {
  return (
    <Badge variant={variantFor(INCIDENT_STATUSES, status)} className={className}>
      {labelFor(INCIDENT_STATUSES, status)}
    </Badge>
  );
}
