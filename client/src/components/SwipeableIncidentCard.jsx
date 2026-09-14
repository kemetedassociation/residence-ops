import { motion, useMotionValue, useTransform } from "framer-motion";
import { MapPin, ThumbsUp } from "lucide-react";
import { IncidentTypeIcon } from "./IncidentTypeIcon";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "../lib/utils";

export function SwipeableIncidentCard({ incident, buildingName, onTap, onSwipeReject }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  const opacity = useTransform(x, [-200, -80, 0, 200], [0.3, 1, 1, 0.3]);
  const rejectOpacity = useTransform(x, [-120, -40, 0], [1, 0, 0]);

  function handleDragEnd(_, info) {
    if (info.offset.x < -110) {
      onSwipeReject?.(incident);
    }
  }

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: "grabbing" }}
      className="relative cursor-grab rounded-xl border border-border bg-card card-elevated"
    >
      <motion.div
        style={{ opacity: rejectOpacity }}
        className="pointer-events-none absolute inset-0 flex items-center justify-end rounded-xl bg-destructive/10 pr-6 text-destructive"
      >
        <span className="text-sm font-semibold">Ignorer</span>
      </motion.div>

      <button type="button" onClick={() => onTap?.(incident)} className="relative flex w-full items-start gap-3 p-4 text-left">
        <IncidentTypeIcon type={incident.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium">{incident.title}</p>
            <StatusBadge status={incident.status} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {buildingName} {incident.floor && `· Étage ${incident.floor}`}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{incident.description}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(incident.created_at)}</span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {incident.confirmation_count || 0}
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
