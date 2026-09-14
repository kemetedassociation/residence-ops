import { Check, Palette } from "lucide-react";
import { useTheme, THEMES } from "../context/ThemeContext";
import { cn } from "../lib/utils";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Palette className="h-4 w-4" />
        Apparence
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-3 text-left transition-all",
              theme === t.value ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t.label}</span>
              {theme === t.value && <Check className="h-4 w-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
