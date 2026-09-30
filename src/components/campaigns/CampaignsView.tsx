import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Check, MapPin, Trees, Leaf, X, Ticket } from 'lucide-react';
import confetti from 'canvas-confetti';
import { FreeCampaign } from '../../types';

export const CampaignsView: React.FC = () => {
  const { 
    campaigns, 
    claimedVouchers,
    applyForCampaignVoucher, 
    setActiveTab
  } = useApp();

  const [activeApplyingCampaign, setActiveApplyingCampaign] = useState<FreeCampaign | null>(null);
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [landSize, setLandSize] = useState<number>(1);

  const latestVoucher = claimedVouchers[0];
  const latestVoucherCampaign = latestVoucher && campaigns.find(c => c.id === latestVoucher.campaignId);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApplyingCampaign) return;

    applyForCampaignVoucher(activeApplyingCampaign.id, {
      name: farmerName,
      phone: farmerPhone,
      district: 'Mukono (Nama)',
      landSizeAcres: landSize,
      quantity: activeApplyingCampaign.maxPerFarmer
    });

    setActiveApplyingCampaign(null);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
            Free Seedling Campaigns
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Access available grants, manage your active vouchers, and track community planting progress across your district.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Latest Voucher */}
          <div className="lg:col-span-7 rounded-3xl bg-white border border-slate-200 p-6 space-y-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Your Seedling Vouchers
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Present your voucher code at any partner nursery to collect your seedlings.
              </p>
            </div>

            {latestVoucher ? (
              <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Voucher Code
                    </span>
                    <div className="text-2xl sm:text-3xl font-extrabold text-[#007A33] font-mono tracking-wide">
                      {latestVoucher.code}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white text-[#007A33] border border-emerald-200 font-bold text-xs flex items-center gap-1 shrink-0">
                    <Check className="w-3.5 h-3.5" /> Active
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Campaign</span>
                    <strong className="text-slate-800">{latestVoucherCampaign?.title ?? 'Seedling grant'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Allocation</span>
                    <strong className="text-slate-800">{latestVoucher.seedlingsCount.toLocaleString()} Seedlings</strong>
                  </div>
                  {latestVoucherCampaign && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Valid Until</span>
                      <strong className="text-slate-800">
                        {new Date(latestVoucherCampaign.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </strong>
                    </div>
                  )}
                </div>

                {claimedVouchers.length > 1 && (
                  <p className="text-[11px] text-slate-500">
                    + {claimedVouchers.length - 1} earlier voucher{claimedVouchers.length > 2 ? 's' : ''}: {claimedVouchers.slice(1).map(v => v.code).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-1">
                <Ticket className="w-6 h-6 mx-auto text-slate-300" />
                <p className="font-semibold">No vouchers yet.</p>
                <p>Apply to an open campaign below to receive one.</p>
              </div>
            )}

            <button
              onClick={() => setActiveTab('map')}
              className="py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors"
            >
              <MapPin className="w-4 h-4 text-slate-500" />
              <span>Find Partner Nurseries</span>
            </button>
          </div>

          {/* Campaign Directory Banner */}
          <div className="lg:col-span-5 rounded-3xl bg-slate-900 overflow-hidden relative min-h-[220px] flex flex-col justify-end p-6 shadow-sm text-white">
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

        {/* Available Campaigns */}
        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Available Campaigns & Grants
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map((camp) => {
              const isTree = camp.logoType === 'tree';
              const isOpen = camp.status === 'Active & Accepting Applications';
              const claimedPercent = Math.min(100, Math.round((camp.seedlingsClaimed / camp.totalSeedlingsFunded) * 100));

              return (
                <div
                  key={camp.id}
                  className="rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between space-y-5 shadow-sm"
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
                          {claimedPercent}%
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#007A33]"
                          style={{ width: `${claimedPercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveApplyingCampaign(camp)}
                      disabled={!isOpen}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-[#007A33] font-bold text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-100 disabled:hover:text-slate-700"
                    >
                      {isOpen ? `Apply for Grant (up to ${camp.maxPerFarmer} seedlings)` : camp.status}
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
                className="w-full py-3 rounded-xl bg-[#007A33] hover:bg-[#00662A] text-white font-bold text-xs mt-2 transition-all shadow-sm"
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
