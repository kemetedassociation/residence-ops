import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Home, MegaphoneIcon, Map, Newspaper, User, Bell, Wallet, UtensilsCrossed, FileText, PartyPopper, Lightbulb, Download } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { CircleMenu } from "../components/ui/circle-menu";
import { api } from "../lib/api";
import { useRealtime } from "../lib/socket";

const navItems = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/signaler", label: "Signaler", icon: MegaphoneIcon },
  { to: "/carte", label: "Carte", icon: Map },
  { to: "/actualites", label: "Actualités", icon: Newspaper },
  { to: "/profil", label: "Profil", icon: User },
];

const quickLinks = [
  { label: "Ma carte", icon: <Wallet size={16} />, href: "/ma-carte" },
  { label: "Restaurant", icon: <UtensilsCrossed size={16} />, href: "/restaurant" },
  { label: "Administration", icon: <FileText size={16} />, href: "/administration" },
  { label: "Loisirs", icon: <PartyPopper size={16} />, href: "/loisirs" },
  { label: "Boîte à idées", icon: <Lightbulb size={16} />, href: "/suggestions" },
  { label: "Installer l'app", icon: <Download size={16} />, href: "/telecharger" },
];

const HINT_KEY = "residence_ops_quicklinks_hint_seen";

export function ResidentLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showHint, setShowHint] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((d) => d.notifications),
  });
  useRealtime("notification:created", () => queryClient.invalidateQueries({ queryKey: ["notifications"] }));

  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(HINT_KEY);
    } catch {
      // ignore
    }
    if (!seen) {
      const timer = setTimeout(() => setShowHint(true), 900);
      return () => clearTimeout(timer);
    }
  }, []);

  function dismissHint() {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="safe-top sticky top-0 z-30 flex items-center justify-end gap-3 bg-background/80 px-4 py-2 backdrop-blur">
        <NavLink to="/notifications" className="relative rounded-full p-2 text-muted-foreground hover:bg-accent">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-destructive">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-destructive" />
            </span>
          )}
        </NavLink>
        <NavLink to="/profil">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{(user?.name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </NavLink>
      </header>

      <main className="flex-1 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating quick-access menu: consolidates the secondary tabs (carte, restaurant,
          administration, loisirs, suggestions, installation) so they don't need their own
          slot in the bottom nav or a dedicated grid in the profile page. */}
      <div
        className="fixed inset-x-0 z-40 flex justify-center"
        style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="relative">
          <AnimatePresence>
            {showHint && (
              <motion.button
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.9 }}
                onClick={dismissHint}
                className="absolute bottom-full left-1/2 mb-3 w-max -translate-x-1/2 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg"
              >
                Vos raccourcis sont ici ✨
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" />
              </motion.button>
            )}
          </AnimatePresence>
          <motion.div
            animate={showHint ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 1.2, repeat: showHint ? Infinity : 0 }}
            onClick={dismissHint}
          >
            <CircleMenu items={quickLinks} />
          </motion.div>
        </div>
      </div>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
