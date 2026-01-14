
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
  const sidebarRef = useRef<HTMLDivElement>(null);

  const getStorageKey = (uid: string) => `mobile_pos_v3_uid_${uid}`;

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
    if (!activeShopId || !data) return;
    const timeoutMins = data.shop.inactivityTimeout || 30;
    
    const resetTimer = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        handleLogout();
        alert(`Session expired due to ${timeoutMins} minutes of inactivity.`);
      }, timeoutMins * 60 * 1000); 
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(name => window.addEventListener(name, resetTimer));
    resetTimer();

    return () => {
      events.forEach(name => window.removeEventListener(name, resetTimer));
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [activeShopId, data?.shop?.inactivityTimeout]);

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
      if (!activeShopId) {
        setData(null);
        setIsLoaded(false);
        return;
      }

      const storageKey = getStorageKey(activeShopId);
      const localData = localStorage.getItem(storageKey);
      let initialData: AppData | null = localData ? JSON.parse(localData) : null;

      try {
        const { doc, getDoc, enableIndexedDbPersistence } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const db = (window as any).db;
        if (db) {
          try {
            await enableIndexedDbPersistence(db);
          } catch (err: any) {
            if (err.code !== 'failed-precondition') console.warn("Persistence Error:", err.code);
          }

          const docRef = doc(db, "shops_v3", activeShopId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
             initialData = docSnap.data() as AppData;
          }
        }
      } catch (err) { 
        console.warn("Offline or Sync Error:", err); 
      }

      if (!initialData) {
        initialData = {
          shop: { 
            name: 'Mobile Phone Shop', 
            address: '', 
            phone: '', 
            isRegistered: true, 
            preparedBy: 'Admin',
            ownerUsername: currentUsername || 'owner',
            inactivityTimeout: 60
          },
          models: [], stocks: [], invoices: [], purchases: [], suppliers: []
        };
      }
      
      setData(initialData);
      setIsLoaded(true);
    };
    fetchCloudData();
  }, [activeShopId]);

  useEffect(() => {
    if (isLoaded && data && activeShopId) {
      const getSafePOJO = (obj: any) => {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (value instanceof HTMLElement || value.constructor?.name === 'FirebaseApp' || key === 'auth' || key === 'db') {
              return undefined;
            }
          }
          return value;
        }));
      };

      const safeData = getSafePOJO(data);
      if (safeData) {
        localStorage.setItem(getStorageKey(activeShopId), JSON.stringify(safeData));
        
        const saveToCloud = async () => {
          try {
            const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const db = (window as any).db;
            if (db) {
              await setDoc(doc(db, "shops_v3", activeShopId), safeData);
            }
          } catch (err) { 
            console.error("Auto-Save Failed:", err); 
          }
        };
        
        const timeout = setTimeout(saveToCloud, 1500);
        return () => clearTimeout(timeout);
      }
    }
  }, [data, isLoaded, activeShopId]);

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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'purchase', label: 'Purchase', icon: Icons.Plus },
    { id: 'invoice', label: 'Sale', icon: Icons.Sale },
    { id: 'stock', label: 'Inventory', icon: Icons.Stock },
    { id: 'models', label: 'Catalog', icon: Icons.Catalog },
    { id: 'reports', label: 'Analytics', icon: Icons.Report },
  ];

  const handleNavClick = (tabId: any) => {
    setActiveTab(tabId);
    setEditingInvoice(null);
    if(tabId === 'stock') setInventorySubTab('available');
    // Auto-hide/collapse sidebar on navigation
    setIsSidebarCollapsed(true);
  };

  if (!activeShopId) return <Auth onLogin={handleLogin} />;
  if (!data) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="animate-spin w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      {!isSidebarCollapsed && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] md:hidden no-print transition-all duration-300" onClick={() => setIsSidebarCollapsed(true)}></div>
      )}
      <aside ref={sidebarRef} className={`bg-white border-r border-slate-100 flex flex-col no-print fixed md:sticky top-0 h-screen z-[100] transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'w-[88px]' : 'w-[280px]'}`}>
        <div className={`p-6 flex-1 overflow-y-auto no-scrollbar flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
          <div className={`flex items-center justify-between mb-12 w-full ${isSidebarCollapsed ? 'flex-col space-y-4' : ''}`}>
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">Mobile POS</h1>
                <p className="text-[7px] font-black uppercase text-slate-400 tracking-[0.4em] mt-1.5">Professional Suite</p>
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); setIsSidebarCollapsed(!isSidebarCollapsed); }} className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-sm">
              <svg className={`w-5 h-5 transition-transform duration-500 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
          </div>
          <nav className="space-y-3 w-full">
            {navItems.map(item => (
              <button key={item.id} onClick={(e) => { e.stopPropagation(); handleNavClick(item.id); }} className={`group relative w-full flex items-center rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isSidebarCollapsed ? 'justify-center p-3.5' : 'px-5 py-3.5 space-x-4'} ${activeTab === item.id ? 'bg-slate-900 text-white shadow-lg translate-x-1' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
                <div className="scale-90 flex-shrink-0"><item.icon /></div>
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
          <div className={`mt-auto pt-6 border-t border-slate-50 w-full space-y-3 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
             <button onClick={(e) => { e.stopPropagation(); handleNavClick('settings'); }} className={`group relative w-full flex items-center rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isSidebarCollapsed ? 'justify-center p-3.5' : 'px-5 py-3.5 space-x-4'} ${activeTab === 'settings' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
                <div className="scale-90 flex-shrink-0"><Icons.Settings /></div>
                {!isSidebarCollapsed && <span>Settings</span>}
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className={`group relative w-full flex items-center rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-transparent ${isSidebarCollapsed ? 'justify-center p-3.5 text-rose-500 hover:bg-rose-50' : 'px-5 py-3.5 space-x-4 bg-slate-50 text-rose-500 hover:bg-rose-100'}`}>
                <div className="scale-90 flex-shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></div>
                {!isSidebarCollapsed && <span>Logout</span>}
              </button>
          </div>
        </div>
      </aside>
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
