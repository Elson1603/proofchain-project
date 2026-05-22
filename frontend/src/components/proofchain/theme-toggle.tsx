import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  showLabel?: boolean;
  className?: string;
};

export function ThemeToggle({ showLabel = false, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "group inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border/80 bg-secondary px-2.5 text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-foreground active:translate-y-0",
        showLabel ? "min-w-28" : "w-9",
        className,
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12" />
      )}
      {showLabel ? <span>{isDark ? "Light" : "Dark"}</span> : null}
    </button>
  );
}
