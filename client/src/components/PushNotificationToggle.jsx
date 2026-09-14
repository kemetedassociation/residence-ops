import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "./ui/button";
import { isPushSupported, getPushSubscriptionStatus, subscribeToPush, unsubscribeFromPush } from "../lib/pushSubscribe";

export function PushNotificationToggle() {
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    getPushSubscriptionStatus().then(setStatus);
  }, []);

  async function handleToggle() {
    setBusy(true);
    try {
      if (status === "subscribed") {
        await unsubscribeFromPush();
        setStatus("unsubscribed");
        toast.success("Notifications push désactivées.");
      } else {
        await subscribeToPush();
        setStatus("subscribed");
        toast.success("Notifications push activées.");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported") {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <BellOff className="h-4 w-4" />
        Les notifications push ne sont pas prises en charge par ce navigateur.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bell className="h-4 w-4" />
        Notifications push
      </div>
      <Button
        variant={status === "subscribed" ? "secondary" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={busy || status === "loading"}
      >
        {status === "subscribed" ? "Désactiver" : "Activer"}
      </Button>
    </div>
  );
}
