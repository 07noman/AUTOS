import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from './features/shell/AppShell';
import { AutoCareShell } from './features/shell/AutoCareShell';
import { Dashboard } from './features/dashboard/Dashboard';
import { POS } from './features/pos/POS';
import { AdvancedPOS } from './features/pos/AdvancedPOS';
import { Products } from './features/products/Products';
import { Customers } from './features/customers/Customers';
import { SalesReport } from './features/reports/SalesReport';
import { LoginPage } from './features/auth/LoginPage';
import { ModuleSelector } from './features/module-selector/ModuleSelector';
import { AutoCareHome } from './features/auto-care/AutoCareHome';
import { AutoCareDashboard } from './features/auto-care/AutoCareDashboard';
import { AutoCarePOS } from './features/auto-care/AutoCarePOS';
import { ServiceJobs } from './features/auto-care/ServiceJobs';
import { NewJobForm } from './features/auto-care/NewJobForm';
import { VehiclesView } from './features/auto-care/VehiclesView';
import VehicleHistoryView from './features/auto-care/VehicleHistoryView';
import { AutoCareModuleView } from './features/auto-care/AutoCareModuleView';
import { AutoCareReportsPage } from './features/auto-care/AutoCareReportsPage';
import { PartsAndProducts } from './features/auto-care/PartsAndProducts';
import { InventoryView } from './features/inventory/InventoryView';
import { POSOrdersPage } from './features/auto-care/POSOrdersPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ReceiptBrandingPage } from './features/settings/ReceiptBrandingPage';
import { useAuth } from './hooks/useAuth';
import { useRealtimeSync } from './hooks/useProducts';
import { initializeDatabase } from './lib/db';
import { initializeAutoCareSchema } from './lib/auto-care-db';
import { initializeSync } from './lib/sync';
import { BusinessHome } from './features/business/BusinessHome';
import { BusinessShell } from './features/business/BusinessShell';
import { MasterDashboard, MasterPOS, MasterInventory, MasterOrders } from './components/master-template';
import { resolveBusinessType } from './lib/businessTypes';
import { AccountActionsPage } from './features/account-actions/AccountActionsPage';

function App() {
  const { isAuthenticated, validateSession } = useAuth();
  const [dbReady, setDbReady] = useState(false);
  const location = useLocation();

  // Supabase Realtime: push data changes across all open devices in real time
  useRealtimeSync();

  useEffect(() => {
    void (async () => {
      try {
        await initializeDatabase();
        await initializeAutoCareSchema();
      } catch (e) {
        console.error('DB init error:', e);
      } finally {
        setDbReady(true);
      }
    })();
  }, []);

  // Proactively verify session with Supabase: kicks out banned or deleted users immediately
  useEffect(() => {
    if (isAuthenticated) {
      void validateSession();
    }
  }, [isAuthenticated, location.pathname, validateSession]);

  useEffect(() => {
    if (isAuthenticated && dbReady) {
      initializeSync();
    }
  }, [isAuthenticated, dbReady]);


  if (!dbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-secondary bg-[#1d1d23]">
        Loading store...
      </div>
    );
  }

  // 1# Check if customer has chosen their business type
  const selectedModule = localStorage.getItem('genx:selectedModule');

  // If no business type chosen yet, FIRST show the Business Setup (FirstActivation) page
  if (!selectedModule && location.pathname !== '/login') {
    return <ModuleSelector />;
  }

  // If business type is chosen, but user is not logged in, ask for login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const isAutoCare = selectedModule === 'auto_care' || selectedModule === 'auto-parts';

  return (
    <Routes>
      {/* Route to switch / choose business type */}
      <Route path="/select-module" element={<ModuleSelector />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/account-actions" element={<AccountActionsPage />} />

      {/* Auto Care App Launcher — Full Screen Odoo-Style (NO sidebar) */}
      <Route path="/auto-care" element={<AutoCareHome />} />

      {/* Auto Care Point of Sale — Full Screen POS-only (NO sidebar, NO dashboard) */}
      <Route path="/auto-care/pos" element={<AutoCarePOS />} />
      <Route path="/auto-care/orders" element={<POSOrdersPage />} />
      <Route path="/orders" element={<POSOrdersPage />} />

      {/* Auto Care Sub-Modules — Clean view with Odoo-style top bar & [Apps] launcher button */}
      <Route path="/auto-care" element={<AutoCareShell />}>
        <Route path="dashboard" element={<AutoCareDashboard />} />
        <Route path="service-jobs" element={<ServiceJobs />} />
        <Route path="jobs" element={<ServiceJobs />} />
        <Route path="jobs/new" element={<NewJobForm />} />
        <Route path="jobs/:jobId" element={<NewJobForm />} />
        <Route path="vehicles" element={<VehiclesView />} />
        <Route path="vehicle-history" element={<VehicleHistoryView />} />
        <Route path="customers" element={<Customers />} />
        <Route path="inventory" element={<InventoryView />} />
        <Route path="estimates" element={<AutoCareModuleView moduleId="estimates" />} />
        <Route path="appointments" element={<AutoCareModuleView moduleId="appointments" />} />
        <Route path="job-board" element={<AutoCareModuleView moduleId="job-board" />} />
        <Route path="payments" element={<AutoCareModuleView moduleId="payments" />} />
        <Route path="staff" element={<AutoCareModuleView moduleId="staff" />} />
        <Route path="parts" element={<Products />} />
        <Route path="orders" element={<POSOrdersPage />} />
        <Route path="reports" element={<AutoCareReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/receipt-branding" element={<ReceiptBrandingPage />} />
        <Route path="settings/receipt" element={<ReceiptBrandingPage />} />
      </Route>

      {/* Unified Business Master Launcher & Sub-Modules (100% Identical to Auto Parts) */}
      <Route path="/business/:businessType" element={<BusinessHome />} />
      <Route path="/business/:businessType/pos" element={<MasterPOS />} />
      <Route path="/business/:businessType/orders" element={<MasterOrders />} />

      <Route path="/business/:businessType" element={<BusinessShell />}>
        <Route path="dashboard" element={<MasterDashboard />} />
        <Route path="service-jobs" element={<ServiceJobs />} />
        <Route path="jobs" element={<ServiceJobs />} />
        <Route path="jobs/new" element={<NewJobForm />} />
        <Route path="jobs/:jobId" element={<NewJobForm />} />
        <Route path="vehicles" element={<VehiclesView />} />
        <Route path="vehicle-history" element={<VehicleHistoryView />} />
        <Route path="customers" element={<Customers />} />
        <Route path="inventory" element={<MasterInventory />} />
        <Route path="estimates" element={<AutoCareModuleView moduleId="estimates" />} />
        <Route path="appointments" element={<AutoCareModuleView moduleId="appointments" />} />
        <Route path="job-board" element={<AutoCareModuleView moduleId="job-board" />} />
        <Route path="payments" element={<AutoCareModuleView moduleId="payments" />} />
        <Route path="staff" element={<AutoCareModuleView moduleId="staff" />} />
        <Route path="parts" element={<Products />} />
        <Route path="orders" element={<MasterOrders />} />
        <Route path="reports" element={<AutoCareReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/receipt-branding" element={<ReceiptBrandingPage />} />
        <Route path="settings/receipt" element={<ReceiptBrandingPage />} />
      </Route>

      {/* All standard business types use the unified Master Template UI */}
      <Route
        path="/pos"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/pos" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/pos`} replace />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/dashboard" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/dashboard`} replace />
          )
        }
      />
      <Route
        path="/inventory"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/inventory" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/inventory`} replace />
          )
        }
      />
      <Route
        path="/customers"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/customers" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/customers`} replace />
          )
        }
      />
      <Route
        path="/products"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/parts" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/parts`} replace />
          )
        }
      />
      <Route
        path="/reports"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/reports" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/reports`} replace />
          )
        }
      />
      <Route
        path="/settings"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/settings" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/settings`} replace />
          )
        }
      />
      <Route
        path="/settings/receipt-branding"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/settings/receipt-branding" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/settings/receipt-branding`} replace />
          )
        }
      />
      <Route
        path="/settings/receipt"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/settings/receipt-branding" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/settings/receipt-branding`} replace />
          )
        }
      />
      <Route
        path="/receipt-branding"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care/settings/receipt-branding" replace />
          ) : (
            <Navigate to={`/business/${selectedModule || 'general'}/settings/receipt-branding`} replace />
          )
        }
      />
      <Route
        path="/"
        element={
          isAutoCare ? (
            <Navigate to="/auto-care" replace />
          ) : selectedModule ? (
            <Navigate to={`/business/${selectedModule}`} replace />
          ) : (
            <Navigate to="/select-module" replace />
          )
        }
      />

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
