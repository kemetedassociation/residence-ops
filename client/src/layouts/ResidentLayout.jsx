import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Home, MegaphoneIcon, Map, Newspaper, User, Bell, Wallet, UtensilsCrossed, FileText, PartyPopper, Lightbulb, Download } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { NavDrawer } from "../components/ui/nav-drawer";
import { api } from "../lib/api";
import { useRealtime } from "../lib/socket";

const mainItems = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/signaler", label: "Signaler", icon: MegaphoneIcon },
  { to: "/carte", label: "Carte", icon: Map },
  { to: "/actualites", label: "Actualités", icon: Newspaper },
  { to: "/profil", label: "Profil", icon: User },
];

const shortcutItems = [
  { to: "/ma-carte", label: "Ma carte", icon: Wallet },
  { to: "/restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { to: "/administration", label: "Administration", icon: FileText },
  { to: "/loisirs", label: "Loisirs", icon: PartyPopper },
  { to: "/suggestions", label: "Boîte à idées", icon: Lightbulb },
  { to: "/telecharger", label: "Installer l'app", icon: Download },
];

function sectionTitle(pathname) {
  const all = [...mainItems, ...shortcutItems];
  const match = all.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
  return match?.label || "Résidence Ops";
}

export function ResidentLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((d) => d.notifications),
  });
  useRealtime("notification:created", () => queryClient.invalidateQueries({ queryKey: ["notifications"] }));

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/80 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-full p-2 text-foreground transition-all duration-150 hover:bg-accent active:scale-90"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <AnimatePresence mode="wait">
            <motion.span
              key={location.pathname}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-semibold"
            >
              {sectionTitle(location.pathname)}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            to="/notifications"
            className="relative rounded-full p-2 text-muted-foreground transition-all duration-150 hover:bg-accent active:scale-90"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-destructive">
                <span className="absolute h-2 w-2 animate-ping rounded-full bg-destructive" />
              </span>
            )}
          </NavLink>
          <NavLink to="/profil" className="transition-transform duration-150 active:scale-90">
            <Avatar className="h-8 w-8 ring-2 ring-transparent transition-shadow hover:ring-primary/30">
              <AvatarFallback>{(user?.name || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          </NavLink>
        </div>
      </header>

      <NavDrawer open={menuOpen} onOpenChange={setMenuOpen} mainItems={mainItems} shortcutItems={shortcutItems} />

      <main className="flex-1 pb-10">
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
    </div>
  );
}
