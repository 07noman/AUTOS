import React, { useState } from "react";
import {
  ShoppingBag,
  Utensils,
  CakeSlice,
  Store,
  Shirt,
  Armchair,
  Coffee,
  Package,
  ArrowRight,
  Check,
  Search,
  Sparkles,
} from "lucide-react";
import "./FirstActivation.css";

export type BusinessType =
  | "restaurant"
  | "bakery"
  | "mart"
  | "retail"
  | "clothing"
  | "furniture"
  | "bar"
  | "auto-parts"
  | "general";

interface BusinessOption {
  id: BusinessType;
  name: string;
  description: string;
  icon: React.ElementType;
}

const BUSINESS_OPTIONS: BusinessOption[] = [
  {
    id: "restaurant",
    name: "Restaurant",
    description: "Tables, menus, kitchen orders and KOT",
    icon: Utensils,
  },
  {
    id: "bakery",
    name: "Bakery",
    description: "Fast counter sales and bakery products",
    icon: CakeSlice,
  },
  {
    id: "mart",
    name: "Mart & Grocery",
    description: "Inventory, barcode sales and stock management",
    icon: Store,
  },
  {
    id: "retail",
    name: "Retail Shop",
    description: "Simple and flexible retail point of sale",
    icon: ShoppingBag,
  },
  {
    id: "clothing",
    name: "Clothing",
    description: "Products with sizes, colors and variants",
    icon: Shirt,
  },
  {
    id: "furniture",
    name: "Furniture",
    description: "Products, stock, quotations and customer orders",
    icon: Armchair,
  },
  {
    id: "bar",
    name: "Cafe & Bar",
    description: "Counter sales, tables and quick service",
    icon: Coffee,
  },
  {
    id: "auto-parts",
    name: "Business pos & store",
    description: "Parts inventory, sales and customer records",
    icon: Store,
  },
  {
    id: "general",
    name: "Other Business",
    description: "A flexible POS setup for your business",
    icon: Package,
  },
];

interface FirstActivationProps {
  /**
   * Connect this to your EXISTING activation function.
   * Do not replace your existing backend/API logic.
   */
  onActivate: (businessType: BusinessType) => Promise<void> | void;

  /**
   * Optional existing user/business name.
   */
  businessName?: string;

  /**
   * Optional callback if the user needs to go back.
   */
  onBack?: () => void;
}

export default function FirstActivation({
  onActivate,
  businessName,
  onBack,
}: FirstActivationProps) {
  const [selectedType, setSelectedType] =
    useState<BusinessType | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredOptions = BUSINESS_OPTIONS.filter((option) => {
    const query = search.toLowerCase();

    return (
      option.name.toLowerCase().includes(query) ||
      option.description.toLowerCase().includes(query)
    );
  });

  const handleContinue = async () => {
    if (!selectedType || loading) return;

    try {
      setLoading(true);

      // IMPORTANT:
      // This calls your existing activation/business setup logic.
      await onActivate(selectedType);

      // Navigation should continue through your existing system.
    } catch (error) {
      console.error("POS activation failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="activation-page">
      <div className="activation-container">

        {/* Header */}
        <header className="activation-header">

          <div className="brand flex items-center">
            {/* Auto-setting Logo Image */}
            <div className="logo-placeholder flex items-center">
              <img
                src="/assets/logo.png"
                alt="GENX CLOUD POS Logo"
                className="h-10 max-w-[220px] object-contain transition-all"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src.endsWith('/assets/logo.png')) {
                    target.src = '/assets/logo.svg';
                  } else {
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.brand-mark-fallback')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'brand-mark brand-mark-fallback';
                      fallback.innerText = 'GX';
                      parent.appendChild(fallback);
                    }
                  }
                }}
              />
            </div>
          </div>



          <div className="activation-badge">
            <Sparkles size={15} />
            <span>First-time setup</span>
          </div>

        </header>

        {/* Main Content */}
        <main className="activation-main">

          <div className="intro">

            <div className="step-label">
              <span className="step-number">1</span>
              <span>Business setup</span>
            </div>

            <h1>
              Choose your business type
            </h1>

            <p>
              {businessName
                ? `Let's configure ${businessName} with the POS features that fit your business.`
                : "Tell us what type of business you run so we can configure your POS experience."}
            </p>

          </div>

          {/* Search */}
          <div className="search-wrapper">

            <Search size={19} />

            <input
              type="text"
              placeholder="Search business type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search business type"
            />

            {search && (
              <button
                className="clear-search"
                onClick={() => setSearch("")}
                type="button"
              >
                ×
              </button>
            )}

          </div>

          {/* Business Cards */}
          <section className="business-grid">

            {filteredOptions.map((option) => {
              const Icon = option.icon;
              const selected = selectedType === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`business-card ${
                    selected ? "selected" : ""
                  }`}
                  onClick={() => setSelectedType(option.id)}
                  aria-pressed={selected}
                >

                  <div className="card-top">

                    <div className="business-icon">
                      <Icon size={29} strokeWidth={1.8} />
                    </div>

                    {selected && (
                      <div className="selected-check">
                        <Check size={15} />
                      </div>
                    )}

                  </div>

                  <div className="business-info">

                    <h2>{option.name}</h2>

                    <p>{option.description}</p>

                  </div>

                </button>
              );
            })}

          </section>

          {filteredOptions.length === 0 && (
            <div className="empty-state">
              <Package size={34} />
              <h3>No business type found</h3>
              <p>
                Try another search or choose Other Business.
              </p>
            </div>
          )}

        </main>

        {/* Bottom Action */}
        <footer className="activation-footer">

          <div className="footer-info">

            <div className="secure-icon">
              <Check size={16} />
            </div>

            <div>
              <strong>Your existing data is safe</strong>
              <span>
                This setup only configures your POS experience.
              </span>
            </div>

          </div>

          <div className="footer-actions">

            {onBack && (
              <button
                type="button"
                className="back-button"
                onClick={onBack}
                disabled={loading}
              >
                Back
              </button>
            )}

            <button
              type="button"
              className="continue-button"
              disabled={!selectedType || loading}
              onClick={handleContinue}
            >
              {loading ? (
                <>
                  <span className="button-loader" />
                  Setting up...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight size={18} />
                </>
              )}
            </button>

          </div>

        </footer>

      </div>
    </div>
  );
}
