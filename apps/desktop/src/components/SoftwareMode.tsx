// src/components/SoftwareMode.tsx

import { useEffect, useState } from "react";
import {
  subscribeConnection,
  verifyServerConnection,
  isOnline,
} from "../services/connectionManager";
import "./SoftwareMode.css";

interface SoftwareModeProps {
  className?: string;
  compact?: boolean;
}

export default function SoftwareMode({ className = "", compact = false }: SoftwareModeProps) {
  const [online, setOnline] = useState<boolean>(isOnline());

  useEffect(() => {
    const unsubscribe = subscribeConnection(setOnline);
    void verifyServerConnection();

    const interval = setInterval(() => {
      void verifyServerConnection();
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={`software-mode ${online ? "online" : "offline"} ${className}`}
      title={online ? "Online Mode: Connected to server" : "Offline Mode: Working from local storage"}
    >
      <span className="mode-dot" />
      <span>{online ? (compact ? "Online" : "Online Mode") : (compact ? "Offline" : "Offline Mode")}</span>
    </div>
  );
}
