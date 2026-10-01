import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  CalendarClock,
  BarChart3,
  Newspaper,
  Users,
  Building2,
  LogOut,
  Settings as SettingsIcon,
  UtensilsCrossed,
  FileText,
  CalendarCheck,
  PartyPopper,
  AlertTriangle,
  Download,
  CreditCard,
  HeartHandshake,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useBranding } from "../context/BrandingContext";

// `module` relie chaque page à une permission (voir server/src/middleware/auth.js, STAFF_MODULES) :
// sans elle, l'entrée est masquée. `null` = toujours visible (lecture ouverte à tous les comptes
// gestionnaire/technicien, aucune permission à vérifier).
const navItems = [
  { to: "/manager", label: "Dashboard", icon: LayoutDashboard, end: true, module: null },
  { to: "/manager/notifications", label: "Notifications", icon: Bell, badge: true, module: null },
  { to: "/manager/incidents", label: "Incidents", icon: ListChecks, module: "incidents" },
  { to: "/manager/planning", label: "Planning", icon: CalendarClock, module: "incidents" },
  { to: "/manager/analytics", label: "Analytics", icon: BarChart3, module: null },
  { to: "/manager/actualites", label: "Actualités", icon: Newspaper, module: "actualites" },
  { to: "/manager/restaurant", label: "Restaurant", icon: UtensilsCrossed, module: "restaurant" },
  { to: "/manager/documents", label: "Documents", icon: FileText, module: "documents" },
  { to: "/manager/rendez-vous", label: "Rendez-vous", icon: CalendarCheck, module: "rendez_vous" },
  { to: "/manager/loisirs", label: "Loisirs", icon: PartyPopper, module: "loisirs" },
  { to: "/manager/utilisateurs", label: "Utilisateurs", icon: Users, module: "utilisateurs" },
  { to: "/manager/accompagnement", label: "Accompagnement", icon: HeartHandshake, module: "accompagnement" },
  { to: "/manager/paiements", label: "Paiements", icon: CreditCard, module: "paiements" },
  { to: "/manager/equipe", label: "Équipe et accès", icon: ShieldCheck, module: "gestion_comptes" },
  { to: "/manager/erreurs", label: "Erreurs", icon: AlertTriangle, module: "erreurs" },
  { to: "/manager/parametres", label: "Paramètres", icon: SettingsIcon, module: "parametres" },
];

function canSee(user, moduleKey) {
  if (!moduleKey) return true;
  if (user?.permissions === null || user?.permissions === undefined) return true; // accès complet
  return user.permissions.includes(moduleKey);
}

export function ManagerLayout() {
  const { user, logout } = useAuth();
  const { displayName, logoUrl } = useBranding();
  const navigate = useNavigate();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((d) => d.notifications),
  });
  const unread = notifications.filter((n) => !n.is_read).length;
  const visibleItems = navItems.filter((item) => canSee(user, item.module));

  function handleLogout() {
    logout();
    navigate("/admin-login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-white">
            {logoUrl ? <img src={logoUrl} alt={displayName} className="h-full w-full object-cover" /> : <Building2 className="h-4 w-4" />}
          </div>
          <span className="truncate font-semibold">{displayName}</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {visibleItems.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge && unread > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-3 py-4">
          <NavLink
            to="/telecharger"
            className="mb-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Download className="h-4 w-4" />
            Installer l'app
          </NavLink>
          <div className="mb-2 px-3 text-xs text-sidebar-foreground/60">{user?.name}</div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <span className="truncate font-semibold">{displayName}</span>
          <button onClick={handleLogout} className="text-sm text-muted-foreground">
            Déconnexion
          </button>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
