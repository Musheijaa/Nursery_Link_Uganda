import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from '../Sidebar';
import { 
  Check, 
  Printer, 
  MapPin, 
  Trees, 
  Leaf, 
  Sparkles, 
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FreeCampaign } from '../../types';

export const CampaignsView: React.FC = () => {
  const { 
    campaigns, 
    applyForCampaignVoucher, 
    setActiveTab, 
    showToast 
  } = useApp();

  const [activeApplyingCampaign, setActiveApplyingCampaign] = useState<FreeCampaign | null>(null);
  const [farmerName, setFarmerName] = useState('Emmanuel Kato');
  const [farmerPhone, setFarmerPhone] = useState('0772458920');
  const [landSize, setLandSize] = useState<number>(2.0);
  const [allocatedVoucherCode, setAllocatedVoucherCode] = useState<string>('NL - 4X9 - QZ2');

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApplyingCampaign) return;

    const code = applyForCampaignVoucher(activeApplyingCampaign.id, {
      name: farmerName,
      phone: farmerPhone,
      district: 'Mukono (Nama)',
      landSizeAcres: landSize,
      quantity: 500
    });

    setAllocatedVoucherCode(code);
    setActiveApplyingCampaign(null);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    showToast('Seedling grant voucher generated successfully!');
  };

  return (
    <div className="flex bg-slate-50 min-h-[calc(100vh-4rem)]">
      
      {/* Left Navigation Sidebar - Matches Screenshot 3 */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 p-6 lg:p-10 space-y-8 max-w-6xl">
        
        {/* Header - Matches Screenshot 3 */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
            Free Seedling Campaigns
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Access available grants, manage your active vouchers, and track community planting progress across your district.
          </p>
        </div>

        {/* Top 2 Cards: Active Voucher + Campaign Directory Banner - Matches Screenshot 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Card 1: Your Active Seedling Vouchers (7 cols) */}
          <div className="lg:col-span-7 rounded-3xl bg-white border border-slate-200 p-6 space-y-5 shadow-xs">
            
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  Your Active Seedling Vouchers
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Present this code at any accredited nursery.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-50 text-[#007A33] border border-emerald-200 font-bold text-xs flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-[#007A33]" /> Verified Active
              </span>
            </div>

            {/* Inner Voucher Container */}
            <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  VOUCHER CODE
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#007A33] font-mono tracking-wide">
                  {allocatedVoucherCode}
                </div>

                <div className="flex items-center space-x-4 pt-1 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Valid Until</span>
                    <strong className="text-slate-800">Oct 31, 2026</strong>
                  </div>
                  <div className="h-6 w-[1px] bg-slate-200"></div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Allocation</span>
                    <strong className="text-slate-800">500 Seedlings</strong>
                  </div>
                </div>
              </div>

              {/* QR Image Mock */}
              <div className="w-28 h-20 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1595079672139-54708050d029?auto=format&fit=crop&w=150&q=80"
                  alt="Voucher QR"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-1">
              <button
                onClick={() => showToast('Printing voucher document...')}
                className="py-2.5 px-5 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print Voucher</span>
              </button>

              <button
                onClick={() => setActiveTab('map')}
                className="py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>Find Nurseries</span>
              </button>
            </div>

          </div>

          {/* Card 2: Campaign Directory Visual Banner (5 cols) */}
          <div className="lg:col-span-5 rounded-3xl bg-slate-900 overflow-hidden relative min-h-[220px] flex flex-col justify-end p-6 shadow-xs text-white">
            <img
              src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80"
              alt="Directory"
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent"></div>

            <div className="relative z-10 space-y-1">
              <h3 className="text-lg font-bold font-display">Campaign Directory</h3>
              <p className="text-xs text-slate-300">
                Browse available regional funding sources across certified districts.
              </p>
            </div>
          </div>

        </div>

        {/* Section: Available Campaigns & Grants - Matches Screenshot 3 */}
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Available Campaigns & Grants
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map((camp) => {
              const isTree = camp.logoType === 'tree';

              return (
                <div
                  key={camp.id}
                  className="rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between space-y-5 shadow-xs"
                >
                  <div className="space-y-4">
                    {/* Top Icon & Badge */}
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                        isTree ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-[#007A33]'
                      }`}>
                        {isTree ? <Trees className="w-5 h-5" /> : <Leaf className="w-5 h-5" />}
                      </div>

                      <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                        {camp.sponsorType}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-display">
                        {camp.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {camp.description}
                      </p>
                    </div>
                  </div>

                  {/* Progress & Button */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-500">Funding Claimed</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {camp.fundingClaimedPercent}%
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#007A33]"
                          style={{ width: `${camp.fundingClaimedPercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveApplyingCampaign(camp)}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-[#007A33] font-bold text-xs transition-colors"
                    >
                      Apply for Grant
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Grant Application Modal */}
      {activeApplyingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 font-display">Apply for Seedling Grant</h3>
              <button onClick={() => setActiveApplyingCampaign(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApply} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Farmer Full Name</label>
                <input
                  type="text"
                  required
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={farmerPhone}
                    onChange={(e) => setFarmerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Land Size (Acres)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={landSize}
                    onChange={(e) => setLandSize(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs mt-2 transition-all shadow-xs"
              >
                Submit & Issue Grant Voucher
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
