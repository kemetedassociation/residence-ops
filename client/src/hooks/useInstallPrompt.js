import { useEffect, useState } from "react";

// L'événement "beforeinstallprompt" ne se déclenche qu'une fois, tôt, potentiellement avant
// qu'un composant ne soit monté pour l'écouter — on le capture donc au niveau module (une
// seule fois pour toute la durée de vie de l'app) plutôt que dans un useEffect qui pourrait
// le manquer.
let deferredEvent = null;
const listeners = new Set();

function notify() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredEvent = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredEvent = null;
    notify();
  });
}

export function isRunningInstalled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Chrome/Edge (desktop et Android) permettent un vrai bouton "Installer" en un clic via cet
// événement. Safari (iOS/macOS) et Firefox ne le supportent pas — pour eux, la page garde les
// instructions manuelles (Partager → Sur l'écran d'accueil, etc.) en repli.
export function useInstallPrompt() {
  const [available, setAvailable] = useState(!!deferredEvent);

  useEffect(() => {
    const update = () => setAvailable(!!deferredEvent);
    listeners.add(update);
    update();
    return () => listeners.delete(update);
  }, []);

  async function promptInstall() {
    if (!deferredEvent) return "unavailable";
    deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    deferredEvent = null;
    setAvailable(false);
    notify();
    return outcome;
  }

  return { available, promptInstall };
}
