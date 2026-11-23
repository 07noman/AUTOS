/**
 * Business Model Detection Utility for GenX Cloud
 *
 * Requirements:
 * IF Business Model = "Retail Store" OR "Mobile Shops":
 *   -> Returns true (Show NEW Inventory Form)
 * IF Business Model = ANY OTHER [Auto Store, AromaBlaze, Grocery, Pharmacy, etc.]:
 *   -> Returns false (Show OLD Inventory Form ONLY)
 *
 * Checks in priority order:
 * 1. Explicit prop/argument passed to component (e.g. businessType prop)
 * 2. Active URL pathname (e.g. /business/retail, /business/mobile, /auto-care)
 * 3. URL search params (?business_type=, ?shop_type=, ?business_model=, ?business_model_id=)
 * 4. Session Storage & Local Storage keys:
 *    - shop_type, business_type, business_model, business_model_id
 *    - genx:selectedModule, genx_businessType, genx:shop_type
 * 5. Auth user metadata (session)
 */

export function normalizeBusinessModelName(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/[_\s-]+/g, ' ');
}

/**
 * Returns true ONLY if the current business model is "Retail Store" or "Mobile Shops"
 * (or their standard variants: "retail", "mobile", "retail store", "retail shop", "mobile shops", "mobile shop").
 *
 * For ANY OTHER business model (Auto Store, AromaBlaze, Grocery, Pharmacy, Cafe, Bakery, Restaurant, etc.),
 * this returns false.
 */
export function isRetailOrMobileBusiness(explicitType?: string | null): boolean {
  // 1. Explicit prop/argument check
  if (explicitType && typeof explicitType === 'string') {
    const norm = normalizeBusinessModelName(explicitType);
    if (isRetailOrMobileMatch(norm)) return true;
    if (isOtherBusinessModelMatch(norm)) return false;
  }

  // 2. Active URL pathname check (highest router truth)
  if (typeof window !== 'undefined' && window.location?.pathname) {
    const path = window.location.pathname.toLowerCase();

    // Check retail/mobile routes
    if (
      path.includes('/business/retail') ||
      path.includes('/business/mobile') ||
      path.includes('/retail') ||
      path.includes('/mobile-shops') ||
      path.includes('/mobile-shop')
    ) {
      return true;
    }

    // Check explicitly other business model routes
    if (
      path.includes('/auto-care') ||
      path.includes('/business/auto-parts') ||
      path.includes('/business/mart') ||
      path.includes('/business/grocery') ||
      path.includes('/business/restaurant') ||
      path.includes('/business/bakery') ||
      path.includes('/business/cafe') ||
      path.includes('/business/clothing') ||
      path.includes('/business/furniture') ||
      path.includes('/pharmacy')
    ) {
      return false;
    }
  }

  // 3. Search parameters
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const sp = new URLSearchParams(window.location.search);
      const queryCandidates = [
        sp.get('business_type'),
        sp.get('shop_type'),
        sp.get('business_model'),
        sp.get('business_model_id'),
        sp.get('module'),
      ];
      for (const val of queryCandidates) {
        if (val) {
          const norm = normalizeBusinessModelName(val);
          if (isRetailOrMobileMatch(norm)) return true;
          if (isOtherBusinessModelMatch(norm)) return false;
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Session and Local Storage keys
  const storageKeys = [
    // Standard session/model keys
    'shop_type',
    'business_model',
    'business_model_id',
    'business_type',
    // GenX namespaced keys
    'genx:shop_type',
    'genx:business_model',
    'genx:business_model_id',
    'genx:business_type',
    'genx_businessType',
    'genx:selectedModule',
  ];

  if (typeof window !== 'undefined') {
    // Check sessionStorage first
    if (window.sessionStorage) {
      for (const k of storageKeys) {
        try {
          const v = window.sessionStorage.getItem(k);
          if (v) {
            const norm = normalizeBusinessModelName(v);
            if (isRetailOrMobileMatch(norm)) return true;
            if (isOtherBusinessModelMatch(norm)) return false;
          }
        } catch {}
      }
    }

    // Check localStorage
    if (window.localStorage) {
      for (const k of storageKeys) {
        try {
          const v = window.localStorage.getItem(k);
          if (v) {
            const norm = normalizeBusinessModelName(v);
            if (isRetailOrMobileMatch(norm)) return true;
            if (isOtherBusinessModelMatch(norm)) return false;
          }
        } catch {}
      }

      // Check user session auth object
      try {
        const rawAuth = window.localStorage.getItem('genx-auth');
        if (rawAuth) {
          const parsed = JSON.parse(rawAuth);
          const meta = parsed?.state?.user?.user_metadata || parsed?.user?.user_metadata;
          if (meta) {
            const metaValues = [
              meta.shop_type,
              meta.business_model,
              meta.business_model_id,
              meta.business_type,
              meta.store_name,
            ];
            for (const mv of metaValues) {
              if (mv && typeof mv === 'string') {
                const norm = normalizeBusinessModelName(mv);
                if (isRetailOrMobileMatch(norm)) return true;
                if (isOtherBusinessModelMatch(norm)) return false;
              }
            }
          }
        }
      } catch {}
    }
  }

  // Default to false (Old Form) for any other or unspecified business model
  return false;
}

function isRetailOrMobileMatch(norm: string): boolean {
  return (
    norm === 'retail' ||
    norm === 'retail store' ||
    norm === 'retail shop' ||
    norm === 'retailstore' ||
    norm === 'retailshop' ||
    norm === 'mobile' ||
    norm === 'mobile shops' ||
    norm === 'mobile shop' ||
    norm === 'mobileshops' ||
    norm === 'mobileshop' ||
    norm === 'mobile phone' ||
    norm === 'mobile phones'
  );
}

function isOtherBusinessModelMatch(norm: string): boolean {
  return (
    norm === 'auto store' ||
    norm === 'autostore' ||
    norm === 'auto care' ||
    norm === 'autocare' ||
    norm === 'auto parts' ||
    norm === 'autoparts' ||
    norm === 'aromablaze' ||
    norm === 'aroma blaze' ||
    norm === 'grocery' ||
    norm === 'mart' ||
    norm === 'mart & grocery' ||
    norm === 'pharmacy' ||
    norm === 'restaurant' ||
    norm === 'bakery' ||
    norm === 'clothing' ||
    norm === 'furniture' ||
    norm === 'cafe' ||
    norm === 'bar' ||
    norm === 'general'
  );
}
