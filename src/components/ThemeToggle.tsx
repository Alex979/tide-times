import { useEffect } from "react";

const STORAGE_KEY = "tide-theme";

export function ThemeToggle() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {}
      if (!stored) {
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    const osDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    try {
      if (isDark === osDark) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-paper text-ink-secondary transition-colors hover:bg-mist hover:text-ink"
    >
      <span className="sr-only dark:hidden">Switch to dark mode</span>
      <span className="sr-only hidden dark:inline">Switch to light mode</span>
      <svg
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4 dark:hidden"
      >
        <path d="M14.75 10.6A5.75 5.75 0 0 1 7.4 3.25a6 6 0 1 0 7.35 7.35Z" />
      </svg>
      <svg
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="hidden h-4 w-4 dark:block"
      >
        <circle cx="9" cy="9" r="3.25" />
        <path d="M9 2.25v1.5M9 14.25v1.5M2.25 9h1.5M14.25 9h1.5M4.23 4.23l1.06 1.06M12.71 12.71l1.06 1.06M13.77 4.23l-1.06 1.06M5.29 12.71l-1.06 1.06" />
      </svg>
    </button>
  );
}
