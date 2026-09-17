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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBranding } from "../context/BrandingContext";

const navItems = [
  { to: "/manager", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/manager/incidents", label: "Incidents", icon: ListChecks },
  { to: "/manager/planning", label: "Planning", icon: CalendarClock },
  { to: "/manager/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/manager/actualites", label: "Actualités", icon: Newspaper },
  { to: "/manager/restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { to: "/manager/documents", label: "Documents", icon: FileText },
  { to: "/manager/rendez-vous", label: "Rendez-vous", icon: CalendarCheck },
  { to: "/manager/loisirs", label: "Loisirs", icon: PartyPopper },
  { to: "/manager/utilisateurs", label: "Utilisateurs", icon: Users },
  { to: "/manager/erreurs", label: "Erreurs", icon: AlertTriangle },
  { to: "/manager/parametres", label: "Paramètres", icon: SettingsIcon },
];

export function ManagerLayout() {
  const { user, logout } = useAuth();
  const { displayName, logoUrl } = useBranding();
  const navigate = useNavigate();

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
          {navItems.map(({ to, label, icon: Icon, end }) => (
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
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-3 py-4">
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
