// src/components/UserMenu.tsx
import React from "react";
import { AccountActionsPage } from "@/features/account-actions/AccountActionsPage";

interface UserMenuProps {
  onLogout: () => void;
  onClose?: () => void;
  className?: string;
  cartItemCount?: number;
  businessType?: string;
}

/**
 * Replaces the legacy dropdown user menu with the full-page Odoo-style Account Actions grid.
 */
export default function UserMenu({
  onLogout,
  onClose,
  cartItemCount = 0,
  businessType,
  className = "",
}: UserMenuProps) {
  return (
    <AccountActionsPage
      onClose={onClose}
      onLogout={onLogout}
      cartItemCount={cartItemCount}
      businessType={businessType}
      className={className}
    />
  );
}
