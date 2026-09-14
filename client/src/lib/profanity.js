const BAD_WORDS = [
  "con", "connard", "conne", "merde", "putain", "salope", "pute", "encule",
  "enculé", "batard", "bâtard", "abruti", "débile", "debile", "idiot",
  "imbécile", "imbecile", "crétin", "cretin", "nul", "pourri", "chiant",
];

const SUGGESTIONS = [
  "Essayez de décrire les faits sans jugement : « le problème persiste depuis... »",
  "Restez factuel : indiquez ce qui ne fonctionne pas et depuis quand.",
  "Une description neutre aide l'équipe technique à intervenir plus vite.",
];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsBadWords(text = "") {
  const lower = text.toLowerCase();
  return BAD_WORDS.some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(lower));
}

export function censorText(text = "") {
  let result = text;
  BAD_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    result = result.replace(regex, (match) => match[0] + "*".repeat(Math.max(match.length - 1, 1)));
  });
  return result;
}

export function getSuggestion() {
  return SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
}
