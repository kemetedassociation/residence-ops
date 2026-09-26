import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isBefore, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

// Calendrier mensuel des disponibilités : chaque jour affiche le nombre de créneaux LIBRES ; les jours sans
// disponibilité ne sont pas cliquables. Les créneaux réservés (vue gestionnaire) marquent le jour en ambre.
export function MonthCalendar({ slots, selectedDay, onSelectDay }) {
  const [month, setMonth] = useState(() => {
    const first = selectedDay || slots.find((s) => !s.is_booked)?.start_at;
    return startOfMonth(first ? new Date(first) : new Date());
  });

  const byDay = useMemo(() => {
    const map = {};
    slots.forEach((s) => {
      const key = format(new Date(s.start_at), "yyyy-MM-dd");
      const d = (map[key] ||= { free: 0, booked: 0 });
      s.is_booked ? d.booked++ : d.free++;
    });
    return map;
  }, [slots]);

  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const today = startOfDay(new Date());
  const canGoBack = !isBefore(addMonths(month, -1), startOfMonth(today));

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" disabled={!canGoBack} onClick={() => setMonth(addMonths(month, -1))} className="rounded-full p-2 hover:bg-accent disabled:opacity-30" aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold capitalize">{format(month, "MMMM yyyy", { locale: fr })}</p>
        <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="rounded-full p-2 hover:bg-accent" aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="pb-1 text-[11px] font-medium text-muted-foreground">
            {w}
          </span>
        ))}
        {days.map((day) => {
          const info = byDay[format(day, "yyyy-MM-dd")];
          const inMonth = isSameMonth(day, month);
          const past = isBefore(day, today);
          const available = !!info && (info.free > 0 || info.booked > 0) && !past;
          const selected = selectedDay && isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={!available || !inMonth}
              onClick={() => onSelectDay(day)}
              className={cn(
                "relative flex h-12 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                !inMonth && "invisible",
                inMonth && !available && "text-muted-foreground/40",
                available && info.free > 0 && !selected && "bg-primary/10 font-semibold text-primary hover:bg-primary/20",
                available && info.free === 0 && !selected && "bg-amber-500/10 font-semibold text-amber-700",
                selected && "bg-primary font-semibold text-primary-foreground",
                isSameDay(day, today) && !selected && "ring-1 ring-primary/50"
              )}
            >
              {format(day, "d")}
              {available && (
                <span className={cn("text-[10px] font-medium leading-none", selected ? "text-primary-foreground/90" : "opacity-80")}>
                  {info.free > 0 ? `${info.free} libre${info.free > 1 ? "s" : ""}` : "complet"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Résumé de la plage horaire d'un jour (« 9h00 → 17h00 ») et créneaux à choisir.
export function DaySlotPicker({ day, slots, selectedId, onSelect }) {
  const freeSlots = slots.filter((s) => isSameDay(new Date(s.start_at), day) && !s.is_booked).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const time = (iso) => format(new Date(iso), "HH'h'mm");

  if (freeSlots.length === 0) return <p className="text-sm text-muted-foreground">Aucun créneau libre ce jour.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="font-semibold capitalize">{format(day, "EEEE d MMMM", { locale: fr })}</span>
        <span className="text-muted-foreground">
          {" "}
          · disponibilités de {time(freeSlots[0].start_at)} à {time(freeSlots[freeSlots.length - 1].end_at)}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {freeSlots.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s)}
            className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition-colors active:scale-95", selectedId === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50")}
          >
            {time(s.start_at)}
            <span className={cn("text-xs font-normal", selectedId === s.id ? "opacity-90" : "text-muted-foreground")}> – {time(s.end_at)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
