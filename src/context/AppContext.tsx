import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Nursery, SeedlingBatch } from '../types';

export type Page = 'home' | 'seedlings' | 'trees' | 'programmes' | 'gaps' | 'orders' | 'nursery' | 'admin' | 'credits';

/** A cart line keeps a snapshot of what the buyer saw; the server re-checks price and stock at checkout. */
export interface CartItem {
  nurseryId: string;
  nurseryName: string;
  nurseryDistrict: string;
  deliveryMethods: Nursery['deliveryMethods'];
  batchId: string;
  speciesId: string;
  speciesName: string;
  seedlingType: SeedlingBatch['seedlingType'];
  unitPriceUGX: number;
  maxQuantity: number;
  quantity: number;
}

interface AppContextType {
  page: Page;
  navigate: (page: Page) => void;

  // Seedling search, shared between the home search, tree guide and the map
  speciesFilter: string | null;
  setSpeciesFilter: (speciesId: string | null) => void;
  districtFilter: string | null;
  setDistrictFilter: (district: string | null) => void;
  buyerDistrict: string;
  setBuyerDistrict: (district: string) => void;

  cart: CartItem[];
  cartCount: number;
  addToCart: (nursery: Nursery, batch: SeedlingBatch, speciesName: string, quantity: number) => void;
  setCartQuantity: (nurseryId: string, batchId: string, quantity: number) => void;
  removeNurseryFromCart: (nurseryId: string) => void;
  isCartOpen: boolean;
  setCartOpen: (open: boolean) => void;

  toast: string | null;
  showToast: (message: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'nurserylink.cart';

const loadCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [page, setPage] = useState<Page>('home');
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [buyerDistrict, setBuyerDistrict] = useState('Kampala');
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [isCartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage can be unavailable (private browsing); the cart still works for this visit
    }
  }, [cart]);

  const showToast = useCallback((message: string) => {
    // Restart the timer so a new toast is never dismissed early by an older one
    clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const navigate = useCallback((next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0 });
  }, []);

  const setCartQuantity = (nurseryId: string, batchId: string, quantity: number) => {
    setCart(prev => prev.flatMap(item => {
      if (item.nurseryId !== nurseryId || item.batchId !== batchId) return [item];
      const capped = Math.min(Math.max(0, Math.floor(quantity)), item.maxQuantity);
      return capped === 0 ? [] : [{ ...item, quantity: capped }];
    }));
  };

  const addToCart = (nursery: Nursery, batch: SeedlingBatch, speciesName: string, quantity: number) => {
    const current = cart.find(i => i.nurseryId === nursery.id && i.batchId === batch.id)?.quantity ?? 0;
    const target = Math.min(current + quantity, batch.quantityAvailable);
    showToast(current + quantity > batch.quantityAvailable
      ? `Only ${batch.quantityAvailable.toLocaleString()} available, so your cart has the maximum`
      : 'Added to cart');

    setCart(prev => {
      const others = prev.filter(i => !(i.nurseryId === nursery.id && i.batchId === batch.id));
      return [...others, {
        nurseryId: nursery.id,
        nurseryName: nursery.name,
        nurseryDistrict: nursery.district,
        deliveryMethods: nursery.deliveryMethods,
        batchId: batch.id,
        speciesId: batch.speciesId,
        speciesName,
        seedlingType: batch.seedlingType,
        unitPriceUGX: batch.unitPriceUGX,
        maxQuantity: batch.quantityAvailable,
        quantity: target,
      }];
    });
  };

  const removeNurseryFromCart = useCallback(
    (nurseryId: string) => setCart(prev => prev.filter(i => i.nurseryId !== nurseryId)),
    []
  );

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <AppContext.Provider
      value={{
        page,
        navigate,
        speciesFilter,
        setSpeciesFilter,
        districtFilter,
        setDistrictFilter,
        buyerDistrict,
        setBuyerDistrict,
        cart,
        cartCount,
        addToCart,
        setCartQuantity,
        removeNurseryFromCart,
        isCartOpen,
        setCartOpen,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
