
import React, { useState, useEffect } from 'react';
import { 
  AppData, 
  ShopAccount, 
  IMEIStock, 
  Invoice, 
  Purchase,
  StockStatus 
} from './types';
import Dashboard from './components/Dashboard';
import ModelMaster from './components/ModelMaster';
import StockManagement from './components/StockManagement';
import InvoiceCreator from './components/InvoiceCreator';
import PurchaseManager from './components/PurchaseManager';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Auth from './components/Auth';
import { Icons } from './constants';

const App: React.FC = () => {
  const [activeShopName, setActiveShopName] = useState<string | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'models' | 'stock' | 'invoice' | 'purchase' | 'reports' | 'settings'>('dashboard');
  const [inventorySubTab, setInventorySubTab] = useState<'available' | 'purchase_history' | 'sales_history'>('available');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastCreatedInvoiceId, setLastCreatedInvoiceId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const getStorageKey = (name: string) => `mobil_delite_data_${name.toLowerCase().replace(/\s/g, '_')}`;

  const translations = {
    en: {
      dashboard: 'Dashboard', invoice: 'Sale Invoice', stock: 'Inventory', models: 'Catalog', history: 'Bills History', reports: 'Analytics', settings: 'Settings', developedBy: 'Fuad Naim Sohag', totalSales: "Today's Sales", monthlySales: "Monthly Sales", stockQty: "Stock Quantity", stockValue: "Stock Value", todayInvoices: "Today Invoices", profit: "Monthly Profit", welcome: "Welcome back", purchase: 'Purchase Entry'
    },
    bn: {
      dashboard: 'ড্যাশবোর্ড', invoice: 'সেল ইনভয়েস', stock: 'ইনভেন্টরি', models: 'ক্যাটালগ', history: 'বিল ইতিহাস', reports: 'অ্যানালিটিক্স', সেটিংস: 'সেটিংস', developedBy: 'ফুয়াদ নাঈম সোহাগ', totalSales: "আজকের বিক্রি", monthlySales: "মাসিক বিক্রি", stockQty: "স্টক পরিমাণ", stockValue: "স্টকের মূল্য", todayInvoices: "আজকের ইনভয়েস", profit: "মাসিক লাভ", welcome: "স্বাগতম", purchase: 'পারচেজ এন্ট্রি'
    }
  };

  // Firebase Auth Listener for Persistent Sessions
  useEffect(() => {
    const initAuthListener = async () => {
      const waitForAuth = () => {
        return new Promise((resolve) => {
          if ((window as any).auth) return resolve((window as any).auth);
          const interval = setInterval(() => {
            if ((window as any).auth) {
              clearInterval(interval);
              resolve((window as any).auth);
            }
          }, 50);
        });
      };

      const auth = await waitForAuth();
      const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

      onAuthStateChanged(auth, (user: any) => {
        if (user) {
          setActiveShopName(user.displayName || user.email.split('@')[0]);
        } else {
          setActiveShopName(null);
        }
      });
    };
    
    initAuthListener();
  }, []);

  useEffect(() => {
    if (activeShopName) {
      const saved = localStorage.getItem(getStorageKey(activeShopName));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.purchases) parsed.purchases = [];
        setData(parsed);
      } else {
        setData({
          shop: {
            name: activeShopName,
            address: '',
            phone: '',
            isRegistered: true,
            language: 'en',
            preparedBy: 'Admin'
          },
          models: [],
          stocks: [],
          invoices: [],
          purchases: []
        });
      }
      setIsLoaded(true);
    } else {
      setData(null);
      setIsLoaded(false);
    }
  }, [activeShopName]);

  useEffect(() => {
    if (isLoaded && data && activeShopName) {
      localStorage.setItem(getStorageKey(activeShopName), JSON.stringify(data));
    }
  }, [data, isLoaded, activeShopName]);

  const handleLogout = async () => {
    const auth = (window as any).auth;
    if (auth) {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
      await signOut(auth);
    }
    setActiveShopName(null);
  };

  if (!activeShopName) {
    return <Auth onLogin={(name) => setActiveShopName(name)} />;
  }

  if (!data) return null;

  const t = translations[data.shop.language || 'en'];

  const handleCreatePurchase = (purchase: Purchase) => {
    setData(prev => {
      if (!prev) return null;
      const newStocks: IMEIStock[] = [];
      purchase.items.forEach(item => {
        item.imeis.forEach(imei => {
          newStocks.push({
            imei,
            modelId: item.modelId,
            status: StockStatus.AVAILABLE,
            dateAdded: purchase.date,
            purchaseId: purchase.id,
            purchasePrice: item.costPrice,
            sellingPrice: item.sellingPrice
          });
        });
      });
      const existingImeis = new Set(prev.stocks.map(s => s.imei));
      const finalNewStocks = newStocks.filter(s => !existingImeis.has(s.imei));
      return {
        ...prev,
        purchases: [...prev.purchases, purchase],
        stocks: [...prev.stocks, ...finalNewStocks]
      };
    });
    setInventorySubTab('purchase_history');
    setActiveTab('stock');
  };

  const handleCreateInvoice = (invoice: Invoice) => {
    setData(prev => {
      if (!prev) return null;
      let updatedInvoices = [...prev.invoices];
      let updatedStocks = [...prev.stocks];
      if (editingInvoice) {
        editingInvoice.items.forEach(item => {
          const stockIdx = updatedStocks.findIndex(s => s.imei === item.imei);
          if (stockIdx > -1) updatedStocks[stockIdx].status = StockStatus.AVAILABLE;
        });
        updatedInvoices = updatedInvoices.map(inv => inv.id === editingInvoice.id ? invoice : inv);
      } else {
        updatedInvoices.push(invoice);
      }
      invoice.items.forEach(item => {
        const stockIdx = updatedStocks.findIndex(s => s.imei === item.imei);
        if (stockIdx > -1) {
          updatedStocks[stockIdx].status = StockStatus.SOLD;
          updatedStocks[stockIdx].invoiceId = invoice.id;
        }
      });
      return { ...prev, invoices: updatedInvoices, stocks: updatedStocks };
    });
    setEditingInvoice(null);
    setLastCreatedInvoiceId(invoice.id);
    setInventorySubTab('sales_history');
    setActiveTab('stock');
  };

  const navigateToHistory = (invoiceId?: string) => {
    if (invoiceId) setLastCreatedInvoiceId(invoiceId);
    setInventorySubTab('sales_history');
    setActiveTab('stock');
  };

  const navigateToPurchaseHistory = () => {
    setInventorySubTab('purchase_history');
    setActiveTab('stock');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      <aside className="w-full md:w-80 bg-white border-r border-slate-100 flex flex-col no-print relative">
        <div className="p-12 pb-8">
          <div className="flex flex-col mb-16">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">MobilTrack</h1>
            <div className="flex items-center mt-2 space-x-1">
               <div className="w-1 h-1 bg-slate-900 rounded-full opacity-20"></div>
               <div className="w-1 h-1 bg-slate-900 rounded-full opacity-40"></div>
               <div className="w-1 h-1 bg-slate-900 rounded-full opacity-60"></div>
               <div className="w-1 h-1 bg-slate-900 rounded-full opacity-80"></div>
               <div className="w-1 h-1 bg-slate-900 rounded-full"></div>
               <span className="text-[8px] font-black uppercase text-slate-400 tracking-[0.4em] ml-2">Systems v1.0</span>
            </div>
          </div>
          
          <nav className="space-y-3">
            {[
              { id: 'dashboard', label: t.dashboard, icon: Icons.Dashboard },
              { id: 'purchase', label: t.purchase, icon: Icons.Plus },
              { id: 'invoice', label: t.invoice, icon: Icons.Sale },
              { id: 'stock', label: t.stock, icon: Icons.Stock },
              { id: 'models', label: t.models, icon: Icons.Catalog },
              { id: 'reports', label: t.reports, icon: Icons.Report },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); setEditingInvoice(null); if(item.id === 'stock') setInventorySubTab('available'); }}
                className={`w-full flex items-center space-x-4 px-6 py-4 rounded-[1.25rem] font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${
                  activeTab === item.id 
                    ? 'bg-slate-900 text-white shadow-2xl shadow-slate-200 translate-x-2' 
                    : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className={`${activeTab === item.id ? 'scale-110 opacity-100' : 'opacity-50'}`}>
                  <item.icon />
                </div>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-8 pt-0">
          <div className="bg-slate-50/50 p-2 rounded-[2rem] border border-slate-100 flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('settings'); setEditingInvoice(null); }}
              className={`flex-1 flex items-center justify-center py-4 rounded-[1.5rem] font-black text-[9px] uppercase tracking-[0.2em] transition-all ${
                activeTab === 'settings' 
                  ? 'bg-white text-slate-900 shadow-lg border border-slate-100' 
                  : 'text-slate-400 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icons.Settings />
              <span className="ml-2">System</span>
            </button>
            <button 
              onClick={handleLogout} 
              className="flex-1 bg-white border border-slate-100 text-rose-500 font-black text-[9px] uppercase tracking-[0.2em] py-4 rounded-[1.5rem] transition-all hover:bg-rose-50 hover:border-rose-100 flex items-center justify-center shadow-sm"
            >
              <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
              Logout
            </button>
          </div>
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em] text-center mt-6">{t.developedBy}</p>
        </div>
      </aside>

      <main className="flex-1 bg-[#fcfcfc] p-6 md:p-16 md:h-screen overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard 
              data={data} 
              setActiveTab={(tab, id) => { 
                if (tab === 'history') { 
                  navigateToHistory(id); 
                } else if (tab === 'purchase_history') {
                  navigateToPurchaseHistory();
                } else { 
                  setActiveTab(tab); 
                } 
              }} 
              onEditInvoice={(inv) => { setEditingInvoice(inv); setActiveTab('invoice'); }}
              onDeleteInvoice={(id) => setData(prev => prev ? ({...prev, invoices: prev.invoices.filter(i => i.id !== id)}) : null)}
              translations={t} 
            />
          )}
          {activeTab === 'purchase' && <PurchaseManager data={data} onCreatePurchase={handleCreatePurchase} />}
          {activeTab === 'models' && (
            <ModelMaster 
              models={data.models} 
              onAdd={m => setData(prev => prev ? ({...prev, models: [...prev.models, m]}) : null)} 
              onUpdate={m => setData(prev => prev ? ({...prev, models: prev.models.map(mod => mod.id === m.id ? m : mod)}) : null)} 
              onDelete={id => setData(prev => prev ? ({...prev, models: prev.models.filter(m => m.id !== id)}) : null)} 
            />
          )}
          {activeTab === 'stock' && (
            <StockManagement 
              data={data} 
              initialTab={inventorySubTab}
              onSubTabChange={setInventorySubTab}
              onUpdateStock={(oldImei, updatedStock) => setData(prev => prev ? ({ ...prev, stocks: prev.stocks.map(s => s.imei === oldImei ? updatedStock : s) }) : null)} 
              onDeleteStock={(imei) => setData(prev => prev ? ({ ...prev, stocks: prev.stocks.filter(s => s.imei !== imei) }) : null)} 
              onDeletePurchase={(id) => setData(prev => prev ? ({ ...prev, purchases: prev.purchases.filter(p => p.id !== id) }) : null)}
              onUpdatePurchase={(p) => setData(prev => prev ? ({ ...prev, purchases: prev.purchases.map(old => old.id === p.id ? p : old) }) : null)}
              initialInvoiceId={lastCreatedInvoiceId}
              onClearInitial={() => setLastCreatedInvoiceId(null)}
              onEditInvoice={(inv) => { setEditingInvoice(inv); setActiveTab('invoice'); }}
              onDeleteInvoice={(id) => setData(prev => prev ? ({...prev, invoices: prev.invoices.filter(i => i.id !== id)}) : null)}
            />
          )}
          {activeTab === 'invoice' && (
            <InvoiceCreator 
              data={data} 
              onCreateInvoice={handleCreateInvoice} 
              editingInvoice={editingInvoice} 
              onCancelEdit={() => navigateToHistory()} 
            />
          )}
          {activeTab === 'reports' && <Reports data={data} />}
          {activeTab === 'settings' && (
            <Settings 
              data={data} 
              onUpdateShop={s => setData(prev => prev ? ({...prev, shop: s}) : null)} 
              onRestore={setData} 
              onResetAll={() => setData(prev => prev ? ({...prev, models:[], stocks:[], invoices:[], purchases: []}) : null)} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
