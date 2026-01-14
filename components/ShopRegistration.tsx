
import React, { useState } from 'react';
import { ShopAccount } from '../types';

interface Props {
  onRegister: (shop: ShopAccount) => void;
}

const ShopRegistration: React.FC<Props> = ({ onRegister }) => {
  const [formData, setFormData] = useState<Omit<ShopAccount, 'isRegistered'>>({
    name: '',
    address: '',
    phone: '',
    email: '',
    preparedBy: 'ADMIN'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.phone) {
      alert("Please fill in all mandatory fields to continue.");
      return;
    }
    onRegister({ ...formData, isRegistered: true });
  };

  const handleSkip = () => {
    onRegister({
      name: 'Mobile Phone Shop',
      address: 'Store Address, Bangladesh',
      phone: '01XXXXXXXXX',
      isRegistered: true,
      preparedBy: 'ADMIN'
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
      
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] p-12 relative z-10 border border-slate-100 animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-900 text-white rounded-3xl mb-6 shadow-2xl shadow-slate-200">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Mobile POS</h1>
          <p className="text-slate-400 text-[10px] font-black mt-3 uppercase tracking-[0.4em]">Business Management Suite</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div className="space-y-4">
            <div className="group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Shop Name</label>
              <input
                type="text"
                required
                placeholder="Enter your business name"
                className="w-full px-6 py-4 bg-slate-50 border border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900 text-sm placeholder:text-slate-300"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="01XXXXXXXXX"
                  className="w-full px-6 py-4 bg-slate-50 border border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900 text-sm placeholder:text-slate-300"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Prepared By</label>
                <input
                  type="text"
                  placeholder="Operator Name"
                  className="w-full px-6 py-4 bg-slate-50 border border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900 text-sm placeholder:text-slate-300"
                  value={formData.preparedBy}
                  onChange={e => setFormData({ ...formData, preparedBy: e.target.value })}
                />
              </div>
            </div>

            <div className="group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Business Address</label>
              <textarea
                required
                placeholder="Store location details..."
                rows={2}
                className="w-full px-6 py-4 bg-slate-50 border border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900 text-sm placeholder:text-slate-300 resize-none"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-6 space-y-4">
            <button
              type="submit"
              className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-slate-200 active:scale-[0.98] uppercase tracking-[0.2em] text-xs hover:bg-black"
            >
              Get Started Now
            </button>
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={handleSkip}
                className="text-slate-400 font-bold py-2 rounded-xl text-[10px] uppercase tracking-widest hover:text-slate-900 transition-colors"
              >
                Skip & Demo
              </button>
              <div className="flex gap-4">
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v1.1.0</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShopRegistration;
