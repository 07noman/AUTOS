// src/services/pwaInstall.ts

let deferredPrompt: any = null;
type PromptListener = (prompt: any) => void;
const listeners: PromptListener[] = [];

export function isAppInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    localStorage.getItem("genx:app-installed") === "true"
  );
}

export function setupPwaInstall(): void {
  if (typeof window === "undefined") return;

  // Listen for modern PWA install prompt
  window.addEventListener("beforeinstallprompt", (event: any) => {
    event.preventDefault();
    deferredPrompt = event;
    (window as any).__GENX_INSTALL_PROMPT = event;
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.warn("[pwaInstall] Listener error:", err);
      }
    });
    window.dispatchEvent(new CustomEvent("pwa-install-prompt", { detail: { prompt: event } }));
  });

  // Listen for successful installation
  window.addEventListener("appinstalled", () => {
    (window as any).__GENX_INSTALL_PROMPT = null;
    deferredPrompt = null;
    try {
      localStorage.setItem("genx:app-installed", "true");
    } catch {
      // ignore
    }
    listeners.forEach((fn) => {
      try {
        fn(null);
      } catch (err) {
        console.warn("[pwaInstall] Listener error:", err);
      }
    });
    window.dispatchEvent(new CustomEvent("pwa-app-installed"));
  });
}

export function getInstallPrompt(): any {
  return (window as any).__GENX_INSTALL_PROMPT || deferredPrompt;
}

export function subscribeInstallPrompt(callback: PromptListener): () => void {
  listeners.push(callback);
  callback(getInstallPrompt());
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export async function promptInstall(): Promise<{ outcome: "accepted" | "dismissed" | "unavailable"; error?: any }> {
  const prompt = getInstallPrompt();
  if (!prompt) {
    return { outcome: "unavailable" };
  }

  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice && choice.outcome === "accepted") {
      try {
        localStorage.setItem("genx:app-installed", "true");
      } catch {
        // ignore
      }
      deferredPrompt = null;
      (window as any).__GENX_INSTALL_PROMPT = null;
      return { outcome: "accepted" };
    }
    return { outcome: choice?.outcome || "dismissed" };
  } catch (err) {
    console.error("[pwaInstall] Prompt execution error:", err);
    return { outcome: "unavailable", error: err };
  }
}
