import React, { createContext, useContext, useState } from 'react';
import { 
  Nursery, 
  TreeSpecies, 
  CartItem, 
  Order, 
  FreeCampaign, 
  DeforestationHotspot, 
  DistrictShadowDeficit,
  SeedlingBatch
} from '../types';
import { UGANDA_NURSERIES } from '../data/ugandaNurseries';
import { TREE_SPECIES } from '../data/treeSpecies';
import { FREE_CAMPAIGNS } from '../data/campaigns';
import { DEFORESTATION_HOTSPOTS, DISTRICT_SHADOW_DEFICITS } from '../data/shadowAnalytics';

export type ActiveTab = 'map' | 'shadow' | 'library' | 'campaigns' | 'orders' | 'dashboard';

interface AppContextType {
  // Navigation & View
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Data
  nurseries: Nursery[];
  species: TreeSpecies[];
  campaigns: FreeCampaign[];
  hotspots: DeforestationHotspot[];
  districtDeficits: DistrictShadowDeficit[];

  // Map & GIS Filters
  selectedNursery: Nursery | null;
  setSelectedNursery: (nursery: Nursery | null) => void;
  targetSpeciesFilter: string | null;
  setTargetSpeciesFilter: (speciesId: string | null) => void;
  selectedDistrict: string;
  setSelectedDistrict: (district: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedCertification: string;
  setSelectedCertification: (cert: string) => void;
  serviceRadiusKm: number; // 5, 10, 20
  setServiceRadiusKm: (radius: number) => void;
  showDeforestationLayer: boolean;
  setShowDeforestationLayer: (show: boolean) => void;
  showServiceZones: boolean;
  setShowServiceZones: (show: boolean) => void;
  userLocation: [number, number];
  setUserLocation: (coords: [number, number]) => void;

  // Cart & Orders
  cart: CartItem[];
  addToCart: (nursery: Nursery, batch: SeedlingBatch, quantity: number) => void;
  removeFromCart: (nurseryId: string, batchId: string) => void;
  updateCartQuantity: (nurseryId: string, batchId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotalQuantity: number;
  cartTotalAmountUGX: number;

  orders: Order[];
  createOrder: (orderData: {
    buyerName: string;
    buyerPhone: string;
    deliveryDistrict: string;
    deliverySubCounty: string;
    deliveryCoordinates: [number, number];
    distanceKm: number;
    paymentMethod: 'MTN Mobile Money' | 'Airtel Money';
    momoNumber: string;
  }) => Order;
  verifyAndReleaseEscrow: (orderId: string, pin: string) => { success: boolean; message: string };

  // Nursery Management
  updateBatchStock: (nurseryId: string, batchId: string, newQuantity: number, newPriceUGX?: number) => void;
  addNewBatch: (nurseryId: string, batch: Omit<SeedlingBatch, 'id'>) => void;

  // Campaign Vouchers
  claimedVouchers: { code: string; campaignId: string; farmerName: string; district: string; seedlingsCount: number; date: string }[];
  applyForCampaignVoucher: (campaignId: string, applicant: { name: string; phone: string; district: string; landSizeAcres: number; quantity: number }) => string;

  // Modals & UI helpers
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  focusedMapCoords: [number, number] | null;
  setFocusedMapCoords: (coords: [number, number] | null) => void;
  toastNotification: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [nurseries, setNurseries] = useState<Nursery[]>(UGANDA_NURSERIES);
  const [species] = useState<TreeSpecies[]>(TREE_SPECIES);
  const [campaigns, setCampaigns] = useState<FreeCampaign[]>(FREE_CAMPAIGNS);
  const [hotspots] = useState<DeforestationHotspot[]>(DEFORESTATION_HOTSPOTS);
  const [districtDeficits] = useState<DistrictShadowDeficit[]>(DISTRICT_SHADOW_DEFICITS);

  const [selectedNursery, setSelectedNursery] = useState<Nursery | null>(null);
  const [targetSpeciesFilter, setTargetSpeciesFilter] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Mukono'); // Defaults to Mukono!
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [selectedCertification, setSelectedCertification] = useState<string>('All Certifications');
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(10);
  const [showDeforestationLayer, setShowDeforestationLayer] = useState<boolean>(true);
  const [showServiceZones, setShowServiceZones] = useState<boolean>(true);
  
  // Mukono Central / Nama Coordinates
  const [userLocation, setUserLocation] = useState<[number, number]>([0.3542, 32.7538]); 
  const [focusedMapCoords, setFocusedMapCoords] = useState<[number, number] | null>([0.3542, 32.7538]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  const [claimedVouchers, setClaimedVouchers] = useState<
    { code: string; campaignId: string; farmerName: string; district: string; seedlingsCount: number; date: string }[]
  >([
    {
      code: 'NFA-MKN-9481',
      campaignId: 'nfa-national-community-2024',
      farmerName: 'Kato Emmanuel',
      district: 'Mukono (Nama)',
      seedlingsCount: 300,
      date: '2026-08-14'
    }
  ]);

  // Demo orders in Mukono
  const [orders, setOrders] = useState<Order[]>([
    {
      id: 'ord-mkn-9021',
      orderNumber: 'NLU-MKN-9021',
      createdAt: '2026-08-18T14:32:00Z',
      buyerName: 'Julius Wasswa',
      buyerPhone: '0772889911',
      deliveryDistrict: 'Mukono',
      deliverySubCounty: 'Goma (Misindye)',
      deliveryCoordinates: [0.3842, 32.7218],
      distanceKm: 5.2,
      nurseryId: 'nfa-nursery-mukono',
      nurseryName: 'National Forestry Authority (NFA) Central Nursery Mukono',
      items: [
        {
          speciesName: 'African Teak / Mvule',
          botanicalName: 'Milicia excelsa',
          quantity: 200,
          unitPriceUGX: 1800,
          pottingType: 'Poly-tube Potted'
        },
        {
          speciesName: 'Musizi / Umbrella Tree',
          botanicalName: 'Maesopsis eminii',
          quantity: 150,
          unitPriceUGX: 900,
          pottingType: 'Root-Trainer Plug'
        }
      ],
      seedlingSubtotalUGX: 495000,
      deliveryFeeUGX: 25400,
      totalAmountUGX: 520400,
      paymentMethod: 'MTN Mobile Money',
      momoNumber: '0772889911',
      momoTransactionRef: 'MTN-ESCROW-89204918',
      escrowStatus: 'In Transit',
      escrowReleasePin: '4829',
      driverName: 'Matovu Francis (Isuzu ELF UBF 412K)',
      driverPhone: '+256 782 119944',
      vehicleType: 'Pickup Canter (Ventilated Seedling Rack)',
      estimatedDeliveryDate: 'Today, 4:30 PM',
      plantingGuideDownloaded: true
    },
    {
      id: 'ord-mkn-8840',
      orderNumber: 'NLU-MKN-8840',
      createdAt: '2026-08-15T09:15:00Z',
      buyerName: 'Sarah Nalubega',
      buyerPhone: '0701445566',
      deliveryDistrict: 'Mukono',
      deliverySubCounty: 'Nakisunga (Wabaale)',
      deliveryCoordinates: [0.2980, 32.7845],
      distanceKm: 8.5,
      nurseryId: 'goma-agroforestry-nursery',
      nurseryName: 'Goma Sub-County Agroforestry & Fruit Tree Hub',
      items: [
        {
          speciesName: 'Grafted Hass Avocado',
          botanicalName: 'Persea americana (Grafted Hass)',
          quantity: 100,
          unitPriceUGX: 4200,
          pottingType: 'Grafted Bare-Root'
        }
      ],
      seedlingSubtotalUGX: 420000,
      deliveryFeeUGX: 32000,
      totalAmountUGX: 452000,
      paymentMethod: 'Airtel Money',
      momoNumber: '0701445566',
      momoTransactionRef: 'AIR-ESCROW-91028374',
      escrowStatus: 'Released to Nursery',
      escrowReleasePin: '7391',
      driverName: 'Wambede Isaac',
      driverPhone: '+256 754 332211',
      vehicleType: 'Boda Boda Dual Crate Carrier',
      estimatedDeliveryDate: 'Delivered Aug 16',
      plantingGuideDownloaded: true
    }
  ]);

  const showToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => {
      setToastNotification(null);
    }, 4000);
  };

  // Cart operations
  const addToCart = (nursery: Nursery, batch: SeedlingBatch, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.nurseryId === nursery.id && item.batch.id === batch.id);
      if (existing) {
        return prev.map(item => 
          item.nurseryId === nursery.id && item.batch.id === batch.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, {
        nurseryId: nursery.id,
        nurseryName: nursery.name,
        nurseryCoordinates: nursery.coordinates,
        nurseryDistrict: nursery.district,
        batch,
        quantity
      }];
    });
    showToast(`Added ${quantity}x ${batch.speciesName} to cart`);
  };

  const removeFromCart = (nurseryId: string, batchId: string) => {
    setCart(prev => prev.filter(item => !(item.nurseryId === nurseryId && item.batch.id === batchId)));
  };

  const updateCartQuantity = (nurseryId: string, batchId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(nurseryId, batchId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.nurseryId === nurseryId && item.batch.id === batchId) {
        return { ...item, quantity };
      }
      return item;
    }));
  };

  const clearCart = () => setCart([]);

  const cartTotalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalAmountUGX = cart.reduce((sum, item) => sum + (item.quantity * item.batch.unitPriceUGX), 0);

  // Order creation & Escrow
  const createOrder = (orderData: {
    buyerName: string;
    buyerPhone: string;
    deliveryDistrict: string;
    deliverySubCounty: string;
    deliveryCoordinates: [number, number];
    distanceKm: number;
    paymentMethod: 'MTN Mobile Money' | 'Airtel Money';
    momoNumber: string;
  }): Order => {
    if (cart.length === 0) throw new Error('Cart is empty');
    
    const primaryNurseryId = cart[0].nurseryId;
    const primaryNursery = nurseries.find(n => n.id === primaryNurseryId) || {
      name: cart[0].nurseryName,
      coordinates: cart[0].nurseryCoordinates
    };

    const seedlingSubtotal = cartTotalAmountUGX;
    const deliveryFee = Math.max(15000, Math.round(10000 + (orderData.distanceKm * 2000)));
    const totalAmount = seedlingSubtotal + deliveryFee;

    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    const randomRefNum = Math.floor(1000 + Math.random() * 9000).toString();
    const orderNum = `NLU-MKN-${randomRefNum}`;
    const txRef = `${orderData.paymentMethod.startsWith('MTN') ? 'MTN' : 'AIR'}-ESCROW-${Date.now().toString().slice(-8)}`;

    const newOrder: Order = {
      id: `ord-mkn-${Date.now()}`,
      orderNumber: orderNum,
      createdAt: new Date().toISOString(),
      buyerName: orderData.buyerName,
      buyerPhone: orderData.buyerPhone,
      deliveryDistrict: orderData.deliveryDistrict,
      deliverySubCounty: orderData.deliverySubCounty,
      deliveryCoordinates: orderData.deliveryCoordinates,
      distanceKm: Number(orderData.distanceKm.toFixed(1)),
      nurseryId: primaryNurseryId,
      nurseryName: primaryNursery.name,
      items: cart.map(item => ({
        speciesName: item.batch.speciesName,
        botanicalName: item.batch.botanicalName,
        quantity: item.quantity,
        unitPriceUGX: item.batch.unitPriceUGX,
        pottingType: item.batch.pottingType
      })),
      seedlingSubtotalUGX: seedlingSubtotal,
      deliveryFeeUGX: deliveryFee,
      totalAmountUGX: totalAmount,
      paymentMethod: orderData.paymentMethod,
      momoNumber: orderData.momoNumber,
      momoTransactionRef: txRef,
      escrowStatus: 'Escrow Funded',
      escrowReleasePin: randomPin,
      driverName: 'Mukono Dispatch Logistics (Van UBB 312X)',
      driverPhone: '+256 701 556677',
      vehicleType: 'Sheltered Seedling Delivery Van',
      estimatedDeliveryDate: 'Within 24 Hours in Mukono',
      plantingGuideDownloaded: false
    };

    setOrders(prev => [newOrder, ...prev]);
    clearCart();
    return newOrder;
  };

  const verifyAndReleaseEscrow = (orderId: string, pin: string): { success: boolean; message: string } => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found' };

    if (order.escrowReleasePin !== pin.trim()) {
      return { success: false, message: 'Invalid 4-digit Delivery PIN. Please check the code provided upon delivery.' };
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          escrowStatus: 'Released to Nursery'
        };
      }
      return o;
    }));

    showToast(`Escrow of UGX ${order.totalAmountUGX.toLocaleString()} successfully released to ${order.nurseryName}!`);
    return { success: true, message: 'Escrow funds verified and disbursed instantly to nursery wallet.' };
  };

  // Nursery Manager updates
  const updateBatchStock = (nurseryId: string, batchId: string, newQuantity: number, newPriceUGX?: number) => {
    setNurseries(prev => prev.map(nur => {
      if (nur.id !== nurseryId) return nur;
      const updatedBatches = nur.batches.map(b => {
        if (b.id !== batchId) return b;
        return {
          ...b,
          quantityAvailable: newQuantity,
          unitPriceUGX: newPriceUGX !== undefined ? newPriceUGX : b.unitPriceUGX
        };
      });
      const newTotal = updatedBatches.reduce((s, b) => s + b.quantityAvailable, 0);
      return {
        ...nur,
        batches: updatedBatches,
        currentStockTotal: newTotal
      };
    }));
    showToast('Batch inventory updated successfully');
  };

  const addNewBatch = (nurseryId: string, batchData: Omit<SeedlingBatch, 'id'>) => {
    const newId = `batch-custom-${Date.now()}`;
    const newBatch: SeedlingBatch = {
      ...batchData,
      id: newId
    };

    setNurseries(prev => prev.map(nur => {
      if (nur.id !== nurseryId) return nur;
      const updatedBatches = [newBatch, ...nur.batches];
      return {
        ...nur,
        batches: updatedBatches,
        currentStockTotal: nur.currentStockTotal + newBatch.quantityAvailable
      };
    }));
    showToast(`New batch for ${batchData.speciesName} registered!`);
  };

  // Campaign Vouchers
  const applyForCampaignVoucher = (
    campaignId: string,
    applicant: { name: string; phone: string; district: string; landSizeAcres: number; quantity: number }
  ): string => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const voucherCode = `MKN-VOUCHER-${Math.floor(1000 + Math.random() * 9000)}`;

    setClaimedVouchers(prev => [
      {
        code: voucherCode,
        campaignId,
        farmerName: applicant.name,
        district: applicant.district,
        seedlingsCount: applicant.quantity,
        date: new Date().toISOString().split('T')[0]
      },
      ...prev
    ]);

    setCampaigns(prev => prev.map(c => {
      if (c.id === campaignId) {
        return {
          ...c,
          seedlingsClaimed: c.seedlingsClaimed + applicant.quantity
        };
      }
      return c;
    }));

    showToast(`Voucher ${voucherCode} generated for ${applicant.quantity} free seedlings in Mukono!`);
    return voucherCode;
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        nurseries,
        species,
        campaigns,
        hotspots,
        districtDeficits,
        selectedNursery,
        setSelectedNursery,
        targetSpeciesFilter,
        setTargetSpeciesFilter,
        selectedDistrict,
        setSelectedDistrict,
        selectedCategory,
        setSelectedCategory,
        selectedCertification,
        setSelectedCertification,
        serviceRadiusKm,
        setServiceRadiusKm,
        showDeforestationLayer,
        setShowDeforestationLayer,
        showServiceZones,
        setShowServiceZones,
        userLocation,
        setUserLocation,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartTotalQuantity,
        cartTotalAmountUGX,
        orders,
        createOrder,
        verifyAndReleaseEscrow,
        updateBatchStock,
        addNewBatch,
        claimedVouchers,
        applyForCampaignVoucher,
        isCheckoutOpen,
        setIsCheckoutOpen,
        focusedMapCoords,
        setFocusedMapCoords,
        toastNotification,
        showToast
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
