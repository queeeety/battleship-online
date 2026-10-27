"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { THEME_STORAGE_KEY, type Theme } from "./theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// unknown on the server: the button stays hidden until hydration
function getServerTheme(): Theme | null {
  return null;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, getTheme, getServerTheme);
  const next: Theme = theme === "light" ? "dark" : "light";

  function switchTheme() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice lasts until reload
    }
  }

  return (
    <Button size="sm" onClick={switchTheme} className={theme === null ? "invisible" : undefined}>
      Switch to {next} theme
    </Button>
  );
}
