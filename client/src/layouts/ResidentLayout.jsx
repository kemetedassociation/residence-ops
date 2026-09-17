import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, Home, MegaphoneIcon, Map, Newspaper, User, Bell, Wallet, UtensilsCrossed, FileText, PartyPopper, Lightbulb, Download } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { NavDrawer } from "../components/ui/nav-drawer";
import { api } from "../lib/api";
import { useRealtime } from "../lib/socket";

// Barre du bas : 4 onglets classiques + un bouton central surélevé pour l'action la plus
// fréquente (signaler), à l'image des apps mobiles natives (voir capture de référence).
const tabItems = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/carte", label: "Carte", icon: Map },
];
const tabItemsRight = [
  { to: "/actualites", label: "Actualités", icon: Newspaper },
  { to: "/profil", label: "Profil", icon: User },
];
const reportItem = { to: "/signaler", label: "Signaler", icon: MegaphoneIcon };

const shortcutItems = [
  { to: "/ma-carte", label: "Ma carte", icon: Wallet },
  { to: "/restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { to: "/administration", label: "Administration", icon: FileText },
  { to: "/loisirs", label: "Loisirs", icon: PartyPopper },
  { to: "/suggestions", label: "Boîte à idées", icon: Lightbulb },
  { to: "/telecharger", label: "Installer l'app", icon: Download },
];

function TabLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink key={to} to={to} end={end} className="relative flex flex-1 flex-col items-center gap-1 py-2 text-xs">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="resident-bottom-nav-pill"
              className="absolute inset-x-2 inset-y-0.5 rounded-lg bg-primary/10"
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            />
          )}
          <Icon className={`relative z-10 h-5 w-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`relative z-10 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function ResidentLayout() {
  const { user } = useAuth();
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
        <button
          onClick={() => setMenuOpen(true)}
          className="rounded-full p-2 text-foreground transition-all duration-150 hover:bg-accent active:scale-90"
          aria-label="Ouvrir le menu des raccourcis"
        >
          <Menu className="h-5 w-5" />
        </button>

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

      <NavDrawer open={menuOpen} onOpenChange={setMenuOpen} shortcutItems={shortcutItems} />

      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center px-2">
          {tabItems.map((item) => (
            <TabLink key={item.to} {...item} />
          ))}

          <div className="relative flex flex-1 flex-col items-center justify-end">
            <NavLink
              to={reportItem.to}
              className="absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
              aria-label={reportItem.label}
            >
              <reportItem.icon className="h-6 w-6" />
            </NavLink>
            <span className="pb-2 pt-9 text-xs text-muted-foreground">{reportItem.label}</span>
          </div>

          {tabItemsRight.map((item) => (
            <TabLink key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </div>
  );
}
