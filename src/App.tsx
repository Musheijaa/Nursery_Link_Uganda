import React from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { NurseryMap } from './components/map/NurseryMap';
import { TreeLibraryView } from './components/library/TreeLibraryView';
import { NurseryShadowView } from './components/shadow/NurseryShadowView';
import { CampaignsView } from './components/campaigns/CampaignsView';
import { OrderTrackingView } from './components/orders/OrderTrackingView';
import { ManagerDashboard } from './components/dashboard/ManagerDashboard';
import { EscrowCheckoutModal } from './components/checkout/EscrowCheckoutModal';
import { CheckCircle2 } from 'lucide-react';
import { LandingPage } from './components/LandingPage';

export const App: React.FC = () => {
  const { activeTab, toastNotification } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 selection:bg-emerald-600 selection:text-white">
      
      {/* Top Navigation */}
      <Navbar />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'home' && <LandingPage />}
        {activeTab === 'map' && <NurseryMap />}
        {activeTab === 'library' && <TreeLibraryView />}
        {activeTab === 'shadow' && <NurseryShadowView />}
        {activeTab === 'campaigns' && <CampaignsView />}
        {activeTab === 'orders' && <OrderTrackingView />}
        {activeTab === 'dashboard' && <ManagerDashboard />}
      </main>

      {/* Global Escrow Checkout Modal */}
      <EscrowCheckoutModal />

      {/* Global Toast Notification */}
      {toastNotification && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50">
          <div className="flex items-center space-x-2.5 px-4 py-3 rounded-2xl bg-white border-2 border-emerald-600 text-slate-900 shadow-xl text-xs backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{toastNotification}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      {activeTab !== 'map' && <Footer />}
    </div>
  );
};

export default App;
