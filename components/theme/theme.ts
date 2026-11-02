export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "mb-theme";

// runs in <head> before first paint: saved choice, else the system setting
export const themeInitScript = `(function(){try{var d=document.documentElement,m=matchMedia("(prefers-color-scheme: light)");function a(){var t=localStorage.getItem("${THEME_STORAGE_KEY}");d.dataset.theme=t==="light"||t==="dark"?t:m.matches?"light":"dark"}a();m.addEventListener("change",a)}catch(e){}})()`;
