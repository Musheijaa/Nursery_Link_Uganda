import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Trash2, CheckCircle2, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Order } from '../../types';
import { deliveryFeeUGX, distanceKm } from '../../utils/geo';

export const EscrowCheckoutModal: React.FC = () => {
  const { 
    cart, 
    cartTotalAmountUGX, 
    removeFromCart, 
    isCheckoutOpen, 
    setIsCheckoutOpen,
    createOrder,
    userLocation,
    showToast
  } = useApp();

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'delivery' | 'payment_prompt' | 'success'>('cart');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [subCounty, setSubCounty] = useState('Mukono (Nama Sub-County)');
  const [paymentMethod, setPaymentMethod] = useState<'MTN Mobile Money' | 'Airtel Money'>('MTN Mobile Money');
  const [momoNumber, setMomoNumber] = useState('');
  const [ussdPinInput, setUssdPinInput] = useState('');
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  const [createdReleasePin, setCreatedReleasePin] = useState('');

  if (!isCheckoutOpen) return null;

  // Orders are fulfilled by the first nursery in the cart; distance is measured to the selected planting site
  const estimatedDeliveryDistanceKm = cart.length > 0
    ? Number(distanceKm(cart[0].nurseryCoordinates, userLocation).toFixed(1))
    : 0;
  const deliveryFee = deliveryFeeUGX(estimatedDeliveryDistanceKm);
  const finalTotal = cartTotalAmountUGX + (cart.length > 0 ? deliveryFee : 0);

  const handleStartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName || !buyerPhone || !momoNumber) {
      showToast('Please fill in your contact and Mobile Money details.');
      return;
    }
    setCheckoutStep('payment_prompt');
  };

  const handleConfirmUssdPin = () => {
    if (ussdPinInput.length < 4) {
      showToast('Please enter your 4-digit Mobile Money PIN to authorize escrow.');
      return;
    }

    const order = createOrder({
      buyerName,
      buyerPhone,
      deliveryDistrict: 'Mukono',
      deliverySubCounty: subCounty,
      deliveryCoordinates: userLocation,
      distanceKm: estimatedDeliveryDistanceKm,
      paymentMethod,
      momoNumber
    });

    if (order) {
      setCreatedOrderNumber(order.orderNumber);
      setCreatedReleasePin(order.escrowReleasePin);
      setCheckoutStep('success');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  const handleClose = () => {
    setIsCheckoutOpen(false);
    setCheckoutStep('cart');
    setUssdPinInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-900">
        
        {/* Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#007A33]" />
            <div>
              <h3 className="font-bold text-slate-900 text-base font-display">
                {checkoutStep === 'payment_prompt' ? 'MTN / Airtel USSD Authorization' : 'Mobile Money Escrow Checkout'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Funds held in neutral escrow until physical delivery in Mukono</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {checkoutStep === 'cart' && (
            <div className="space-y-5">
              {cart.length === 0 ? (
                <div className="text-center py-10 space-y-3 text-slate-400">
                  <p className="text-sm font-semibold">Your seedling cart is empty.</p>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl bg-[#007A33] text-white text-xs font-bold"
                  >
                    Explore Mukono Nurseries
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {cart.map((item) => (
                      <div key={`${item.nurseryId}-${item.batch.id}`} className="pt-3 flex items-center justify-between text-xs">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{item.batch.speciesName}</h4>
                          <p className="text-slate-500 text-[11px]">{item.nurseryName} • {item.batch.pottingType}</p>
                          <span className="font-mono text-slate-700">{item.quantity} seedlings @ UGX {item.batch.unitPriceUGX}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            UGX {(item.quantity * item.batch.unitPriceUGX).toLocaleString()}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.nurseryId, item.batch.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Seedlings Subtotal:</span>
                      <span className="font-mono font-bold">UGX {cartTotalAmountUGX.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery (~{estimatedDeliveryDistanceKm} km to planting site):</span>
                      <span className="font-mono font-bold">UGX {deliveryFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                      <span>Total Escrow Authorization:</span>
                      <span className="font-mono text-[#007A33]">UGX {finalTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setCheckoutStep('delivery')}
                    className="w-full py-3 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <span>Proceed to Delivery & Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}

          {checkoutStep === 'delivery' && (
            <form onSubmit={handleStartPayment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Delivery Sub-County (Mukono)</label>
                <select
                  value={subCounty}
                  onChange={(e) => setSubCounty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="Mukono (Nama Sub-County)">Nama Sub-County</option>
                  <option value="Mukono (Goma Sub-County)">Goma Sub-County</option>
                  <option value="Mukono (Nakisunga Sub-County)">Nakisunga Sub-County</option>
                  <option value="Mukono (Kyampisi Sub-County)">Kyampisi Sub-County</option>
                  <option value="Mukono (Mpatta / Katosi)">Mpatta / Katosi Shoreline</option>
                  <option value="Mukono (Kasawo Sub-County)">Kasawo Sub-County</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as Order['paymentMethod'])}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="MTN Mobile Money">MTN MoMo (*165#)</option>
                    <option value="Airtel Money">Airtel Money (*185#)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mobile Money Number</label>
                  <input
                    type="text"
                    required
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all mt-4"
              >
                <span>Authorize Escrow of UGX {finalTotal.toLocaleString()}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {checkoutStep === 'payment_prompt' && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center mx-auto text-[#007A33]">
                <Smartphone className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 font-display">USSD Push Notification Sent</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Authorize escrow deposit of <strong>UGX {finalTotal.toLocaleString()}</strong> on phone {momoNumber}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-xs mx-auto space-y-3">
                <span className="text-[11px] font-mono text-slate-600 block">
                  {paymentMethod === 'MTN Mobile Money' ? 'MTN MoMo (*165# Prompt)' : 'Airtel Money Prompt'}
                </span>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={ussdPinInput}
                  onChange={(e) => setUssdPinInput(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl font-mono text-center text-lg font-bold text-slate-900 focus:outline-none focus:border-[#007A33]"
                />
              </div>

              <button
                onClick={handleConfirmUssdPin}
                className="w-full py-3 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs shadow-sm transition-all"
              >
                Confirm Payment & Lock Escrow
              </button>
            </div>
          )}

          {checkoutStep === 'success' && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center mx-auto text-[#007A33]">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900 font-display">Order Escrow Secured!</h4>
                <p className="text-xs text-slate-500 font-mono mt-1">Order Ref: {createdOrderNumber}</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 max-w-sm mx-auto space-y-1 text-xs">
                <span className="text-slate-500 block text-[10px]">Your Secret Delivery Release PIN:</span>
                <div className="text-2xl font-mono font-extrabold text-[#007A33] tracking-widest">{createdReleasePin}</div>
                <p className="text-[11px] text-slate-600 mt-1">Provide this PIN to the driver upon delivery inspection in Mukono.</p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-[#007A33] text-white font-bold text-xs"
              >
                Done
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
