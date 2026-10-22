/**
 * MASTER BUSINESS TYPE CONFIGURATION
 *
 * This is the single source of truth for all supported business types.
 * Auto Parts is the master template — every other business type renders
 * the exact same UI shell, just with a different businessType prop.
 *
 * HOW IT WORKS:
 *  - Each entry maps a businessType key → its display config
 *  - Routes: /business/:businessType  (new unified shell)
 *  - Auto Parts legacy routes /auto-care remain untouched
 *  - Database: each record includes a business_type column (additive migration)
 */

import {
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  Car,
  History,
  Users,
  Package,
  FileText,
  BarChart3,
  Settings,
  ClipboardList,
  CreditCard,
  CalendarDays,
  User,
  Boxes,
  Receipt,
  Utensils,
  CakeSlice,
  Store,
  ShoppingBag,
  Shirt,
  Armchair,
  Coffee,
} from 'lucide-react';
import type { ElementType } from 'react';

// ── Business Type Keys ────────────────────────────────────────────────────────

export type BusinessTypeKey =
  | 'restaurant'
  | 'bakery'
  | 'mart'
  | 'retail'
  | 'clothing'
  | 'furniture'
  | 'cafe'
  | 'auto-parts'
  | 'bar'
  | 'general';

// ── Per-business UI Config ────────────────────────────────────────────────────

export interface BusinessConfig {
  /** Display name shown in the launcher and header */
  name: string;
  /** Short description shown on the module-selector cards */
  label: string;
  /** Lucide icon used in the selector card */
  selectorIcon: ElementType;
  /** Database prefix / value stored in the business_type column */
  dbPrefix: string;
  /** Colour of the header accent dot  */
  accentColor: string;
}

export const BUSINESS_TYPES: Record<BusinessTypeKey, BusinessConfig> = {
  restaurant: {
    name: 'Restaurant',
    label: 'Tables, menus, kitchen orders and KOT',
    selectorIcon: Utensils,
    dbPrefix: 'restaurant',
    accentColor: '#f57c00',
  },
  bakery: {
    name: 'Bakery',
    label: 'Fast counter sales and bakery products',
    selectorIcon: CakeSlice,
    dbPrefix: 'bakery',
    accentColor: '#e91e63',
  },
  mart: {
    name: 'Mart & Grocery',
    label: 'Inventory, barcode sales and stock management',
    selectorIcon: Store,
    dbPrefix: 'mart',
    accentColor: '#43a047',
  },
  retail: {
    name: 'Retail Shop',
    label: 'Simple and flexible retail point of sale',
    selectorIcon: ShoppingBag,
    dbPrefix: 'retail',
    accentColor: '#1e88e5',
  },
  clothing: {
    name: 'Clothing',
    label: 'Products with sizes, colors and variants',
    selectorIcon: Shirt,
    dbPrefix: 'clothing',
    accentColor: '#8e24aa',
  },
  furniture: {
    name: 'Furniture',
    label: 'Products, stock, quotations and customer orders',
    selectorIcon: Armchair,
    dbPrefix: 'furniture',
    accentColor: '#6d4c41',
  },
  cafe: {
    name: 'Cafe & Bar',
    label: 'Counter sales, tables and quick service',
    selectorIcon: Coffee,
    dbPrefix: 'cafe',
    accentColor: '#00838f',
  },
  'auto-parts': {
    name: 'Business pos & store',
    label: 'Parts inventory, sales and customer records',
    selectorIcon: Store,
    dbPrefix: 'auto_parts',
    accentColor: '#3949ab',
  },
  bar: {
    name: 'Cafe & Bar',
    label: 'Counter sales, tables and quick service',
    selectorIcon: Coffee,
    dbPrefix: 'cafe',
    accentColor: '#00838f',
  },
  general: {
    name: 'Other Business',
    label: 'A flexible POS setup for your business',
    selectorIcon: Package,
    dbPrefix: 'other',
    accentColor: '#546e7a',
  },
};

// ── Module App Definition ─────────────────────────────────────────────────────

export interface BusinessApp {
  id: string;
  name: string;
  icon: ElementType;
  iconBg: string;
  /** Absolute href, e.g. /business/restaurant/pos */
  href: string;
}

/**
 * Returns the 16-module launcher grid for any business type.
 * ALL business types share exactly the same 16 modules — this is intentional.
 * Only the base path changes (e.g. /business/restaurant vs /business/bakery).
 */
export function getBusinessApps(businessType: BusinessTypeKey): BusinessApp[] {
  const base = `/business/${businessType}`;
  return [
    { id: 'dashboard',       name: 'Dashboard',        icon: LayoutDashboard, iconBg: 'bg-[#3949ab]', href: `${base}/dashboard` },
    { id: 'pos',             name: 'Point of Sale',    icon: ShoppingCart,    iconBg: 'bg-[#00897b]', href: `${base}/pos` },
    { id: 'service-jobs',    name: 'Service Jobs',     icon: Wrench,          iconBg: 'bg-[#f57c00]', href: `${base}/service-jobs` },
    { id: 'vehicles',        name: 'Vehicles',         icon: Car,             iconBg: 'bg-[#7b1fa2]', href: `${base}/vehicles` },
    { id: 'vehicle-history', name: 'Vehicle History',  icon: History,         iconBg: 'bg-[#00838f]', href: `${base}/vehicle-history` },
    { id: 'customers',       name: 'Customers',        icon: Users,           iconBg: 'bg-[#d81b60]', href: `${base}/customers` },
    { id: 'inventory',       name: 'Inventory',        icon: Package,         iconBg: 'bg-[#3949ab]', href: `${base}/inventory` },
    { id: 'estimates',       name: 'Estimates',        icon: FileText,        iconBg: 'bg-[#f9a825]', href: `${base}/estimates` },
    { id: 'appointments',    name: 'Appointments',     icon: CalendarDays,    iconBg: 'bg-[#00897b]', href: `${base}/appointments` },
    { id: 'job-board',       name: 'Job Board',        icon: ClipboardList,   iconBg: 'bg-[#e53935]', href: `${base}/job-board` },
    { id: 'payments',        name: 'Payments',         icon: CreditCard,      iconBg: 'bg-[#7cb342]', href: `${base}/payments` },
    { id: 'staff',           name: 'Staff',            icon: User,            iconBg: 'bg-[#6a1b9a]', href: `${base}/staff` },
    { id: 'parts',           name: 'Parts & Products', icon: Boxes,           iconBg: 'bg-[#ef6c00]', href: `${base}/parts` },
    { id: 'orders',          name: 'POS Orders',       icon: Receipt,         iconBg: 'bg-[#0d9488]', href: `${base}/orders` },
    { id: 'reports',         name: 'Reports',          icon: BarChart3,       iconBg: 'bg-[#0288d1]', href: `${base}/reports` },
    { id: 'settings',        name: 'Settings',         icon: Settings,        iconBg: 'bg-[#546e7a]', href: `${base}/settings` },
  ];
}

/**
 * Resolves a legacy/stored business type string to a valid BusinessTypeKey.
 * Handles old keys like "auto_care", "bar", "general", etc.
 */
export function resolveBusinessType(raw: string | null | undefined): BusinessTypeKey {
  if (!raw) return 'general';
  const map: Record<string, BusinessTypeKey> = {
    auto_care:  'auto-parts',
    'auto-care': 'auto-parts',
    'auto-parts': 'auto-parts',
    restaurant: 'restaurant',
    bakery:     'bakery',
    mart:       'mart',
    retail:     'retail',
    clothing:   'clothing',
    furniture:  'furniture',
    cafe:       'cafe',
    bar:        'cafe',
    general:    'general',
    other:      'general',
  };
  return map[raw.toLowerCase()] ?? 'general';
}
