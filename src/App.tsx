import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Page, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HomePage } from './components/home/HomePage';
import { FindSeedlingsPage } from './components/seedlings/FindSeedlingsPage';
import { TreeGuidePage } from './components/trees/TreeGuidePage';
import { ProgrammesPage } from './components/programmes/ProgrammesPage';
import { PlantingGapsPage } from './components/gaps/PlantingGapsPage';
import { OrdersPage } from './components/orders/OrdersPage';
import { NurseryPortalPage } from './components/nursery/NurseryPortalPage';
import { CreditsPage } from './components/credits/CreditsPage';
import { AdminPage } from './components/admin/AdminPage';
import { CartPanel } from './components/cart/CartPanel';

const PAGES: Record<Page, React.FC> = {
  home: HomePage,
  seedlings: FindSeedlingsPage,
  trees: TreeGuidePage,
  programmes: ProgrammesPage,
  gaps: PlantingGapsPage,
  orders: OrdersPage,
  nursery: NurseryPortalPage,
  admin: AdminPage,
  credits: CreditsPage,
};

export const App: React.FC = () => {
  const { page, toast } = useApp();
  const CurrentPage = PAGES[page];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <CurrentPage />
      </main>

      {/* The map page fills the viewport, so it has no footer */}
      {page !== 'seedlings' && <Footer />}

      <CartPanel />

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 lg:bottom-6">
          <div className="flex items-center gap-2 rounded-md bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-300" />
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
