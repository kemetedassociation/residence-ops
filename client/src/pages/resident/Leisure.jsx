import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { startOfWeek, addDays, isSameDay, format } from "date-fns";
import { fr } from "date-fns/locale";
import { PartyPopper, MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { api } from "../../lib/api";
import { ACTIVITY_CATEGORIES, findMeta } from "../../lib/constants";
import { cn } from "../../lib/utils";

export function Leisure() {
  const [weekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(new Date());

  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get("/activities").then((d) => d.activities),
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const dayActivities = activities.filter((a) => isSameDay(new Date(a.activity_date), selectedDay));
  const countFor = (day) => activities.filter((a) => isSameDay(new Date(a.activity_date), day)).length;

  return (
    <div className="pb-6">
      <div className="hero-gradient flex items-center gap-3 px-4 py-6 text-white">
        <PartyPopper className="h-6 w-6" />
        <h1 className="text-xl font-bold">Loisirs</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const count = countFor(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors",
                  isSameDay(day, selectedDay) ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <span className="text-[10px] capitalize text-muted-foreground">{format(day, "EEE", { locale: fr })}</span>
                <span className="text-sm font-semibold">{format(day, "d")}</span>
                {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        <h2 className="text-sm font-semibold capitalize text-muted-foreground">
          {format(selectedDay, "EEEE d MMMM", { locale: fr })}
        </h2>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDay.toDateString()}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {dayActivities.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Aucune activité ce jour.
              </p>
            )}
            {dayActivities.map((activity, index) => {
              const category = findMeta(ACTIVITY_CATEGORIES, activity.category);
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.25 }}
                >
                  <Card className="overflow-hidden">
                    <div className="flex">
                      <div className="w-1.5 shrink-0" style={{ background: category?.color }} />
                      <CardContent className="flex-1 p-4">
                        <div className="mb-1 flex items-center justify-between">
                          <Badge variant="outline" style={{ borderColor: category?.color, color: category?.color }}>
                            {category?.label}
                          </Badge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {activity.start_time}
                            {activity.end_time && ` – ${activity.end_time}`}
                          </span>
                        </div>
                        <p className="font-medium">{activity.title}</p>
                        {activity.description && <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>}
                        {activity.location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {activity.location}
                          </p>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
