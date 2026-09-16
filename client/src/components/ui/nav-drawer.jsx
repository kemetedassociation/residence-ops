import { AnimatePresence, motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

function DrawerLink({ to, label, icon: Icon, end, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors active:scale-[0.98]",
          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </NavLink>
  );
}

// Panneau de navigation unique, ouvert depuis le bouton ☰ de l'en-tête : regroupe toutes
// les sections de l'app (principales + raccourcis) au même endroit, plutôt que de les
// répartir entre une barre du bas et un menu séparé.
export function NavDrawer({ open, onOpenChange, shortcutItems }) {
  function close() {
    onOpenChange(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            key="panel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="safe-top safe-bottom fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-xs flex-col bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-muted-foreground">Raccourcis</span>
              <button
                onClick={close}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent active:scale-90"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
              {shortcutItems.map((item) => (
                <DrawerLink key={item.to} {...item} onNavigate={close} />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
