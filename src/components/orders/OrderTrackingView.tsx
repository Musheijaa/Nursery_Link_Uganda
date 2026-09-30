import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from '../Sidebar';
import { Truck, CheckCircle2, KeyRound, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export const OrderTrackingView: React.FC = () => {
  const { orders, verifyAndReleaseEscrow, setActiveTab } = useApp();
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [enteredPin, setEnteredPin] = useState<{ [orderId: string]: string }>({});
  const [errorMessage, setErrorMessage] = useState<{ [orderId: string]: string }>({});

  const activeOrder = orders.find(o => o.id === selectedOrderId) || orders[0];

  const handleReleaseEscrow = (orderId: string) => {
    const pin = enteredPin[orderId] || '';
    const res = verifyAndReleaseEscrow(orderId, pin);
    if (!res.success) {
      setErrorMessage(prev => ({ ...prev, [orderId]: res.message }));
    } else {
      setErrorMessage(prev => ({ ...prev, [orderId]: '' }));
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-[calc(100vh-4rem)]">
      
      <Sidebar activeSection="escrow" />

      {/* Main Content Area */}
      <div className="flex-1 p-6 lg:p-10 space-y-8 max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              Escrow Wallet & Order Tracking
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Funds remain secured in neutral custody until you physically inspect healthy seedlings in Mukono.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('map')}
            className="py-2.5 px-4 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs shadow-sm transition-all"
          >
            Order More Seedlings
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="p-16 rounded-3xl bg-white border border-slate-200 text-center text-slate-400">
            <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-bold text-slate-800">No Active Orders</h3>
            <p className="text-xs text-slate-500 mt-1">Place an order from the Mukono nurseries map.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Orders List (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Order History</h2>

              {orders.map((order) => {
                const isSelected = order.id === activeOrder?.id;
                const isReleased = order.escrowStatus === 'Released to Nursery';

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white ${
                      isSelected
                        ? 'border-[#007A33] ring-1 ring-[#007A33] shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-xs text-slate-900">{order.orderNumber}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isReleased ? 'bg-emerald-50 text-[#007A33]' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {order.escrowStatus}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-800">{order.nurseryName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{order.items.reduce((s, i) => s + i.quantity, 0)} Seedlings • {order.deliverySubCounty}</p>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-xs">
                      <span className="font-mono font-bold text-[#007A33]">UGX {order.totalAmountUGX.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Order Details (8 cols) */}
            {activeOrder && (
              <div className="lg:col-span-8 space-y-6">
                
                <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400">Selected Order</span>
                      <h3 className="text-xl font-bold text-slate-900 font-mono">{activeOrder.orderNumber}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Payment Method</span>
                      <span className="text-xs font-bold text-[#007A33]">{activeOrder.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Escrow Release Box */}
                  {activeOrder.escrowStatus !== 'Released to Nursery' ? (
                    <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                            <KeyRound className="w-4 h-4 text-[#007A33]" />
                            <span>Release Escrow to Nursery</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Inspect your seedlings on site in Mukono. Enter your secret 4-digit PIN to disburse payment.
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-500 font-semibold block">Secret PIN:</span>
                          <span className="text-base font-mono font-bold text-[#007A33] bg-white px-2.5 py-1 rounded-xl border border-emerald-200">
                            {activeOrder.escrowReleasePin}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="Enter PIN"
                          value={enteredPin[activeOrder.id] || ''}
                          onChange={(e) => setEnteredPin({ ...enteredPin, [activeOrder.id]: e.target.value })}
                          className="w-full sm:w-40 py-2.5 px-4 bg-white border border-slate-300 rounded-xl font-mono text-center text-lg font-bold text-slate-900 focus:outline-none focus:border-[#007A33]"
                        />
                        <button
                          onClick={() => handleReleaseEscrow(activeOrder.id)}
                          className="w-full sm:flex-1 py-2.5 px-5 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs shadow-sm transition-all"
                        >
                          Verify & Disburse UGX {activeOrder.totalAmountUGX.toLocaleString()}
                        </button>
                      </div>

                      {errorMessage[activeOrder.id] && (
                        <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {errorMessage[activeOrder.id]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-slate-800 text-xs flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-[#007A33] shrink-0" />
                      <div>
                        <strong>Escrow Released Successfully</strong>
                        <p className="text-[11px] text-slate-500">Funds disbursed to nursery's mobile money wallet.</p>
                      </div>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="pt-2">
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Order Items</h4>
                    <div className="divide-y divide-slate-100">
                      {activeOrder.items.map((it, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{it.speciesName}</span>
                            <p className="text-[11px] text-slate-400 italic">{it.botanicalName}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900">{it.quantity} Seedlings</span>
                            <p className="text-[11px] text-slate-400">UGX {(it.quantity * it.unitPriceUGX).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
};
