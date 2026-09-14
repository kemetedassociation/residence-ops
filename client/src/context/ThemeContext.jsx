import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "residence_ops_theme";

export const THEMES = [
  { value: "moderne", label: "Moderne épuré", description: "Épuré, aéré, animations douces" },
  { value: "riche", label: "Riche & coloré", description: "Gradients vifs, sensation grand public" },
  { value: "sombre", label: "Sombre premium", description: "Thème sombre, effet verre, accents néon" },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || "moderne");

  useEffect(() => {
    document.documentElement.setAttribute("data-style", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function setTheme(value) {
    setThemeState(value);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
