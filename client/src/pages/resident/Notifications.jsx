import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Info, AlertTriangle, CheckCircle2, Wrench, BellOff, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import { useRealtime } from "../../lib/socket";
import { NOTIFICATION_TYPES } from "../../lib/constants";
import { cn } from "../../lib/utils";
import { requestNotificationPermission, showBrowserNotification } from "../../lib/pushNotify";
import { notificationLink } from "../../lib/notificationLink";
import { useAuth } from "../../context/AuthContext";

const ICONS = { info: Info, alerte: AlertTriangle, resolution: CheckCircle2, intervention: Wrench };

export function Notifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((d) => d.notifications),
  });

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useRealtime("notification:created", (notif) => {
    showBrowserNotification(notif.title, notif.message, notificationLink(notif, user?.role));
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  // Un appui marque la notification comme lue ET emmène sur la page (ou l'onglet) concerné.
  async function open(n) {
    const link = notificationLink(n, user?.role);
    if (!n.is_read) markRead(n.id).catch(() => {});
    if (link) navigate(link);
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="pb-6">
      <div className="hero-gradient flex items-center justify-between px-4 py-6 text-white">
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-sm opacity-90">{unreadCount} non lue(s)</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            Tout marquer lu
          </Button>
        )}
      </div>

      <div className="mx-auto max-w-lg space-y-2 px-4 py-4">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <BellOff className="h-8 w-8" />
            <p className="text-sm">Aucune notification pour le moment.</p>
          </div>
        )}

        {notifications.map((n) => {
          const meta = NOTIFICATION_TYPES[n.type] || NOTIFICATION_TYPES.info;
          const Icon = ICONS[n.type] || Info;
          return (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={cn(
                "relative flex w-full items-start gap-3 rounded-lg border-l-4 bg-card p-4 text-left card-elevated",
                n.is_read ? "border-l-transparent opacity-70" : ""
              )}
              style={!n.is_read ? { borderLeftColor: meta.color } : undefined}
            >
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.bg, meta.text)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
              {notificationLink(n, user?.role) && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              {!n.is_read && (
                <span className="relative mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }}>
                  <span
                    className="absolute inset-0 animate-ping rounded-full"
                    style={{ background: meta.color }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
