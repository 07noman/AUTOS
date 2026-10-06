// src/components/UserMenu.tsx

import React from "react";
import SoftwareMode from "./SoftwareMode";
import { isOnline } from "../services/connectionManager";
import "./UserMenu.css";

interface UserMenuProps {
  onLogout: () => void;
  onClose?: () => void;
  className?: string;
}

export default function UserMenu({ onLogout, onClose, className = "" }: UserMenuProps) {
  const openWhatsApp = () => {
    if (!isOnline()) {
      alert("WhatsApp requires an internet connection.");
      return;
    }

    window.open(
      "https://wa.me/923342826675",
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleHelp = () => {
    alert("GenX Cloud POS Support: Contact your administrator or call 03342826675 for technical assistance.");
  };

  const installApp = async () => {
    const event = (window as any).__GENX_INSTALL_PROMPT;

    if (!event) {
      alert("App installation is not available in this browser.");
      return;
    }

    try {
      event.prompt();
      const choice = await event.userChoice;
      if (choice && choice.outcome === "accepted") {
        console.log("User accepted PWA installation");
      }
    } catch (e) {
      console.error("Installation prompt error:", e);
    }

    (window as any).__GENX_INSTALL_PROMPT = null;
  };

  return (
    <>
      {onClose && <div className="genx-user-menu-backdrop" onClick={onClose} />}
      <div className={`genx-user-menu ${className}`} role="menu" aria-label="User account menu">
        {/* Help */}
        <div className="menu-section">
          <button
            type="button"
            className="menu-button"
            style={{ padding: "4px 0" }}
            onClick={handleHelp}
          >
            <div className="menu-title">Help</div>
          </button>
        </div>

        {/* Shortcuts */}
        <div className="menu-section">
          <div className="menu-title">Shortcuts</div>
          <div className="menu-subtitle">Coming Soon</div>
        </div>

        {/* Software Modes */}
        <div className="menu-section" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="menu-title">Software Modes</div>
          <div>
            <SoftwareMode />
          </div>
        </div>

        {/* WhatsApp Contact */}
        <button type="button" className="menu-button" onClick={openWhatsApp}>
          <span>WhatsApp Contact</span>
          <small>03342826675</small>
        </button>

        {/* App Install */}
        <button type="button" className="menu-button" onClick={installApp}>
          <span>App Install</span>
          <small>PWA</small>
        </button>

        {/* Logout */}
        <button
          type="button"
          className="menu-logout"
          onClick={() => {
            onClose?.();
            onLogout();
          }}
        >
          <span>Log out</span>
          <span>→</span>
        </button>
      </div>
    </>
  );
}
