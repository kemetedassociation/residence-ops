import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

// Carrousel horizontal simple (glisser au doigt ou à la souris, points de navigation,
// défilement automatique) — pas de nouvelle dépendance, juste Framer Motion (déjà utilisé
// partout dans l'app).
export function Carousel({ items, renderItem, className, autoPlayMs = 6000 }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!autoPlayMs || items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), autoPlayMs);
    return () => clearInterval(id);
  }, [autoPlayMs, items.length]);

  useEffect(() => {
    if (index > items.length - 1) setIndex(0);
  }, [items.length, index]);

  if (!items || items.length === 0) return null;

  function goTo(next) {
    setIndex(Math.max(0, Math.min(items.length - 1, next)));
  }

  function onDragEnd(_, info) {
    const threshold = 60;
    if (info.offset.x < -threshold) goTo(index + 1);
    else if (info.offset.x > threshold) goTo(index - 1);
  }

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden rounded-2xl">
        <motion.div
          className="flex"
          drag={items.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={onDragEnd}
          animate={{ x: `-${index * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
        >
          {items.map((item, i) => (
            <div key={item.id ?? i} className="w-full shrink-0">
              {renderItem(item, i)}
            </div>
          ))}
        </motion.div>
      </div>

      {items.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Diapositive ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
