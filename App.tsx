
import React, { useState, useEffect, useRef } from 'react';
import { 
  AppData, 
  ShopAccount, 
  IMEIStock, 
  Invoice, 
  Purchase,
  StockStatus,
  Supplier
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
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'models' | 'stock' | 'invoice' | 'purchase' | 'reports' | 'settings'>('dashboard');
  const [inventorySubTab, setInventorySubTab] = useState<'available' | 'purchase_history' | 'sales_history'>('available');
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastCreatedInvoiceId, setLastCreatedInvoiceId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const idleTimerRef = useRef<number | null>(null);

  const getStorageKey = (username: string) => `mobil_pos_v2_user_${username}`;

  const handleLogout = async () => {
    const auth = (window as any).auth;
    if (auth) {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
      await signOut(auth);
    }
    setActiveShopId(null);
    setCurrentUsername(null);
    setData(null);
    setIsLoaded(false);
  };

  const handleLogin = (uid: string, username: string) => {
    setActiveShopId(uid);
    setCurrentUsername(username);
  };

  useEffect(() => {
    if (!activeShopId) return;
    const resetTimer = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        handleLogout();
        alert("Session expired due to 30 minutes of inactivity.");
      }, 30 * 60 * 1000); 
    };
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(name => window.addEventListener(name, resetTimer));
    resetTimer();
    return () => {
      events.forEach(name => window.removeEventListener(name, resetTimer));
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [activeShopId]);

  useEffect(() => {
    const initAuthListener = async () => {
      const auth = (window as any).auth;
      if (!auth) {
        setTimeout(initAuthListener, 200);
        return;
      }
      const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
      onAuthStateChanged(auth, (user: any) => {
        if (user) {
          setActiveShopId(user.uid);
          if (user.email) {
            setCurrentUsername(user.email.split('@')[0]);
          }
        } else {
          setActiveShopId(null);
          setCurrentUsername(null);
        }
      });
    };
    initAuthListener();
  }, []);

  useEffect(() => {
    const fetchCloudData = async () => {
      if (!activeShopId || !currentUsername) {
        if (activeShopId && !currentUsername) return; 
        setData(null);
        setIsLoaded(false);
        return;
      }

      const storageKey = getStorageKey(currentUsername);
      const localData = localStorage.getItem(storageKey);
      let initialData: AppData | null = localData ? JSON.parse(localData) : null;

      try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const db = (window as any).db;
        if (db) {
          const docRef = doc(db, "shops", currentUsername);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
             initialData = docSnap.data() as AppData;
          }
        }
      } catch (err) { 
        console.error("Cloud Fetch Sync Error:", err); 
      }

      if (!initialData) {
        initialData = {
          shop: { 
            name: 'My New Phone Shop', 
            address: '', 
            phone: '', 
            isRegistered: true, 
            preparedBy: 'Admin',
            ownerUsername: currentUsername
          },
          models: [], stocks: [], invoices: [], purchases: [], suppliers: []
        };
      }
      
      if (!initialData.suppliers) initialData.suppliers = [];
      
      setData(initialData);
      setIsLoaded(true);
    };
    fetchCloudData();
  }, [activeShopId, currentUsername]);

  useEffect(() => {
    if (isLoaded && data && currentUsername) {
      localStorage.setItem(getStorageKey(currentUsername), JSON.stringify(data));
      
      const saveToCloud = async () => {
        try {
          const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
          const db = (window as any).db;
          if (db) {
            const sanitizedData = JSON.parse(JSON.stringify(data, (key, value) => {
              return value === undefined ? null : value;
            }));
            await setDoc(doc(db, "shops", currentUsername), sanitizedData);
          }
        } catch (err) { 
          console.error("Cloud Save Sync Error:", err); 
        }
      };
      
      const timeout = setTimeout(saveToCloud, 2000);
      return () => clearTimeout(timeout);
    }
  }, [data, isLoaded, currentUsername]);

  const handleCreatePurchase = (p: Purchase) => {
    setData(prev => {
      if (!prev) return null;
      const supplierExists = prev.suppliers.some(s => s.name.toLowerCase() === p.supplierName.toLowerCase());
      let updatedSuppliers = prev.suppliers;
      if (!supplierExists && p.supplierName) {
        const newSupplier: Supplier = {
          id: Math.random().toString(36).substr(2, 9),
          name: p.supplierName,
          phone: p.supplierPhone || '',
          address: p.supplierAddress || ''
        };
        updatedSuppliers = [...prev.suppliers, newSupplier];
      }
      return {
        ...prev,
        purchases: [...prev.purchases, p],
        suppliers: updatedSuppliers,
        stocks: [
          ...prev.stocks, 
          ...p.items.flatMap(it => it.imeis.map(imei => ({ 
            imei, 
            modelId: it.modelId, 
            status: StockStatus.AVAILABLE, 
            dateAdded: p.date, 
            purchaseId: p.id, 
            purchasePrice: it.costPrice, 
            sellingPrice: it.sellingPrice 
          })))
        ] 
      };
    });
  };

  if (!activeShopId) return <Auth onLogin={handleLogin} />;
  if (!data) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="animate-spin w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'purchase', label: 'Purchase', icon: Icons.Plus },
    { id: 'invoice', label: 'Sale', icon: Icons.Sale },
    { id: 'stock', label: 'Inventory', icon: Icons.Stock },
    { id: 'models', label: 'Catalog', icon: Icons.Catalog },
    { id: 'reports', label: 'Analytics', icon: Icons.Report },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      {/* Persistent Floating Toggle Button - The ONLY thing visible when sidebar is hidden */}
      <button 
        onClick={() => setIsSidebarCollapsed(false)}
        className={`fixed top-6 left-6 z-[120] no-print p-3.5 rounded-2xl bg-slate-900 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-500 ease-out ${
          !isSidebarCollapsed ? 'opacity-0 pointer-events-none -translate-x-12' : 'opacity-100 translate-x-0'
        }`}
        title="Show Sidebar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>

      {/* Sidebar Overlay for Mobile */}
      {!isSidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] md:hidden no-print transition-all duration-300"
          onClick={() => setIsSidebarCollapsed(true)}
        ></div>
      )}

      <aside 
        className={`bg-white border-r border-slate-100 flex flex-col no-print fixed md:sticky top-0 h-screen z-[100] transition-all duration-500 ease-in-out ${
          isSidebarCollapsed ? '-translate-x-full w-0 invisible opacity-0 overflow-hidden' : 'translate-x-0 w-[300px] visible opacity-100'
        }`}
      >
        <div className="p-8 pb-8 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between mb-12">
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Smart POS</h1>
              <p className="text-[7px] font-black uppercase text-slate-400 tracking-[0.4em] mt-1.5">Enterprise Suite</p>
            </div>
            
            {/* Collapse Button inside Sidebar */}
            <button 
              onClick={() => setIsSidebarCollapsed(true)}
              className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
          
          <nav className="space-y-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { 
                  setActiveTab(item.id as any); 
                  setEditingInvoice(null); 
                  if(item.id === 'stock') setInventorySubTab('available'); 
                  if(window.innerWidth < 768) setIsSidebarCollapsed(true); 
                }}
                className={`w-full flex items-center space-x-4 px-5 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  activeTab === item.id ? 'bg-slate-900 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                <div className="scale-90"><item.icon /></div>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 pt-0 mt-auto">
          <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 flex items-center gap-2">
            <button 
              onClick={() => { setActiveTab('settings'); setEditingInvoice(null); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }} 
              className={`flex-1 py-3 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
            >
              Settings
            </button>
            <button 
              onClick={handleLogout} 
              className="flex-1 bg-white border border-slate-100 text-rose-500 font-black text-[8px] uppercase tracking-widest py-3 rounded-xl shadow-sm hover:bg-rose-50 transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-[#fcfcfc] min-h-screen relative overflow-x-hidden transition-all duration-500">
        <div className="max-w-6xl mx-auto p-6 md:p-12">
          {activeTab === 'dashboard' && <Dashboard data={data} setActiveTab={(tab, id) => { if (tab === 'history') { setInventorySubTab('sales_history'); setActiveTab('stock'); } else setActiveTab(tab); }} onEditInvoice={(inv) => { setEditingInvoice(inv); setActiveTab('invoice'); }} onDeleteInvoice={(id) => setData(prev => prev ? ({...prev, invoices: prev.invoices.filter(i => i.id !== id)}) : null)} translations={{dashboard: 'Dashboard', welcome: 'Welcome', totalSales: 'Today Sales', monthlySales: 'Monthly Sales', stockQty: 'Total Units', stockValue: 'Stock Value', todayInvoices: 'Daily Count', profit: 'Monthly Profit', invoice: 'Quick Sale', history: 'Sales Log'}} />}
          {activeTab === 'purchase' && <PurchaseManager data={data} onCreatePurchase={handleCreatePurchase} />}
          {activeTab === 'models' && <ModelMaster models={data.models} onAdd={m => setData(prev => prev ? ({...prev, models: [...prev.models, m]}) : null)} onUpdate={m => setData(prev => prev ? ({...prev, models: prev.models.map(mod => mod.id === m.id ? m : mod)}) : null)} onDelete={id => setData(prev => prev ? ({...prev, models: prev.models.filter(m => m.id !== id)}) : null)} />}
          {activeTab === 'stock' && <StockManagement data={data} initialTab={inventorySubTab} onSubTabChange={setInventorySubTab} onUpdateStock={(old, n) => setData(prev => prev ? ({...prev, stocks: prev.stocks.map(s => s.imei === old ? n : s)}) : null)} onDeleteStock={imei => setData(prev => prev ? ({...prev, stocks: prev.stocks.filter(s => s.imei !== imei)}) : null)} onDeletePurchase={id => setData(prev => prev ? ({...prev, purchases: prev.purchases.filter(p => p.id !== id)}) : null)} onUpdatePurchase={p => setData(prev => prev ? ({...prev, purchases: prev.purchases.map(o => o.id === p.id ? p : o)}) : null)} initialInvoiceId={lastCreatedInvoiceId} onClearInitial={() => setLastCreatedInvoiceId(null)} onEditInvoice={inv => { setEditingInvoice(inv); setActiveTab('invoice'); }} onDeleteInvoice={id => setData(prev => prev ? ({...prev, invoices: prev.invoices.filter(i => i.id !== id)}) : null)} />}
          {activeTab === 'invoice' && <InvoiceCreator data={data} onCreateInvoice={inv => { setData(prev => { if (!prev) return null; let invs = editingInvoice ? prev.invoices.map(i => i.id === inv.id ? inv : i) : [...prev.invoices, inv]; let sts = prev.stocks.map(s => { const sold = inv.items.some(it => it.imei === s.imei); return sold ? {...s, status: StockStatus.SOLD, invoiceId: inv.id} : s; }); return {...prev, invoices: invs, stocks: sts }; }); setEditingInvoice(null); setLastCreatedInvoiceId(inv.id); setInventorySubTab('sales_history'); setActiveTab('stock'); }} editingInvoice={editingInvoice} onCancelEdit={() => setActiveTab('stock')} />}
          {activeTab === 'reports' && <Reports data={data} />}
          {activeTab === 'settings' && <Settings data={data} onUpdateShop={s => setData(prev => prev ? ({...prev, shop: s}) : null)} onRestore={setData} onResetAll={() => setData(prev => prev ? ({...prev, models:[], stocks:[], invoices:[], purchases: [], suppliers: []}) : null)} />}
        </div>
      </main>
    </div>
  );
};

export default App;
