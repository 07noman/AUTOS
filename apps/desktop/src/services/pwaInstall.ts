// src/services/pwaInstall.ts

let deferredPrompt: any = null;

export function setupPwaInstall(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (event: any) => {
    event.preventDefault();
    deferredPrompt = event;
    (window as any).__GENX_INSTALL_PROMPT = event;
  });

  window.addEventListener("appinstalled", () => {
    (window as any).__GENX_INSTALL_PROMPT = null;
    deferredPrompt = null;
  });
}

export function getInstallPrompt(): any {
  return (window as any).__GENX_INSTALL_PROMPT || deferredPrompt;
}
