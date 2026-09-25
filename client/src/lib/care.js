// Numéros d'aide en France. À faire vérifier avant la mise en production (ils peuvent évoluer).
export const URGENT_NUMBERS = [
  { number: "3114", label: "Prévention du suicide", detail: "Gratuit, 24h/24, 7j/7", tone: "danger" },
  { number: "15", label: "SAMU — urgence médicale", detail: "Danger immédiat, malaise, tentative", tone: "danger" },
  { number: "112", label: "Urgences (numéro européen)", detail: "Police, pompiers, secours", tone: "danger" },
];

export const LISTENING_NUMBERS = [
  { number: "0 800 235 236", tel: "0800235236", label: "Fil Santé Jeunes", detail: "Anonyme et gratuit, 12-25 ans, 9h-23h" },
  { number: "09 72 39 40 50", tel: "0972394050", label: "SOS Amitié", detail: "Écoute anonyme, 24h/24" },
  { number: "3919", tel: "3919", label: "Violences Femmes Info", detail: "Gratuit et anonyme, 24h/24" },
  { number: "116 117", tel: "116117", label: "Médecin de garde", detail: "Soir, week-end et jours fériés (non urgent)" },
];

export const MODE_LABELS = { presentiel: "Sur place", visio: "En visio", les_deux: "Sur place ou visio" };

const gcalDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Titre volontairement neutre : un agenda est souvent partagé ou affiché sur un écran verrouillé.
export function calendarLinks(a) {
  const title = `Rendez-vous — ${a.professional_name}`;
  const location = a.mode === "visio" ? "Visioconférence" : a.address || "";
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gcalDate(a.start_at)}/${gcalDate(a.end_at)}&location=${encodeURIComponent(location)}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=${encodeURIComponent(title)}&startdt=${encodeURIComponent(a.start_at)}&enddt=${encodeURIComponent(a.end_at)}&location=${encodeURIComponent(location)}`,
  };
}
