
import React, { useState } from 'react';
import { AppData, StockStatus, Invoice, PaymentMethod } from '../types';
import { Icons } from '../constants';

interface Props {
  data: AppData;
  setActiveTab: (tab: any, id?: string) => void;
  onEditInvoice: (inv: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  translations: any;
}

interface TrackRecord {
  sl: number;
  invoiceNo: string;
  branchName: string;
  serial: string;
  date: string;
  transaction: string;
  name: string;
  mobile: string;
  modelNo: string;
  type: 'PURCHASE' | 'SALE';
  originalInvoice?: Invoice;
}

const formatAmount = (val: number) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Dashboard: React.FC<Props> = ({ data, setActiveTab, onEditInvoice, onDeleteInvoice, translations: t }) => {
  const [imeiSearch, setImeiSearch] = useState('');
  const [searchResults, setSearchResults] = useState<TrackRecord[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  const todayInvoices = data.invoices.filter(inv => inv.date.startsWith(today));
  const monthlyInvoices = data.invoices.filter(inv => inv.date.startsWith(thisMonth));

  const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const monthlySales = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const availableStock = data.stocks.filter(s => s.status === StockStatus.AVAILABLE);
  
  const monthlyProfit = monthlyInvoices.reduce((acc, inv) => {
    const cost = inv.items.reduce((itemSum, item) => {
      const stockEntry = data.stocks.find(s => s.imei === item.imei);
      return itemSum + (stockEntry?.purchasePrice || 0);
    }, 0);
    return acc + (inv.total - cost);
  }, 0);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = imeiSearch.trim().toLowerCase();
    if (!query) {
      setSearchResults(null);
      setHasSearched(false);
      return;
    }
    const results: TrackRecord[] = [];
    setHasSearched(true);

    // 1. Search in Stocks (IMEI based)
    const matchedStocks = data.stocks.filter(s => s.imei.toLowerCase().includes(query));
    
    matchedStocks.forEach(stock => {
      const model = data.models.find(m => m.id === stock.modelId);
      const purchaseRecord = data.purchases.find(p => p.id === stock.purchaseId);
      
      // Add Purchase entry
      results.push({ 
        sl: 0, 
        invoiceNo: purchaseRecord?.purchaseNumber || "N/A", 
        branchName: data.shop.name, 
        serial: stock.imei, 
        date: stock.dateAdded ? new Date(stock.dateAdded).toLocaleDateString() : 'N/A', 
        transaction: 'Purchase', 
        name: purchaseRecord?.supplierName || "N/A", 
        mobile: purchaseRecord?.supplierPhone || "", 
        modelNo: model ? `${model.brand} ${model.modelName}` : "N/A", 
        type: 'PURCHASE' 
      });

      // If sold, add Sale entry
      if (stock.status === StockStatus.SOLD) {
        const inv = data.invoices.find(i => i.items.some(it => it.imei === stock.imei));
        if (inv) {
          results.push({ 
            sl: 0, 
            invoiceNo: inv.invoiceNumber, 
            branchName: data.shop.name, 
            serial: stock.imei, 
            date: new Date(inv.date).toLocaleDateString(), 
            transaction: 'Sale', 
            name: inv.customerName, 
            mobile: inv.customerPhone, 
            modelNo: model ? `${model.brand} ${model.modelName}` : "N/A", 
            type: 'SALE', 
            originalInvoice: inv 
          });
        }
      }
    });

    // 2. Search in Invoices (Name or Invoice Number based)
    const matchedInvoices = data.invoices.filter(inv => 
      inv.invoiceNumber.toLowerCase().includes(query) || 
      inv.customerName.toLowerCase().includes(query) ||
      inv.customerPhone.includes(query)
    );

    matchedInvoices.forEach(inv => {
      inv.items.forEach(item => {
        // Avoid duplicates if we already added it via IMEI search
        if (!results.some(r => r.invoiceNo === inv.invoiceNumber && r.serial === item.imei)) {
          results.push({ 
            sl: 0, 
            invoiceNo: inv.invoiceNumber, 
            branchName: data.shop.name, 
            serial: item.imei, 
            date: new Date(inv.date).toLocaleDateString(), 
            transaction: 'Sale', 
            name: inv.customerName, 
            mobile: inv.customerPhone, 
            modelNo: `${item.brand} ${item.modelName}`, 
            type: 'SALE', 
            originalInvoice: inv 
          });
        }
      });
    });
    
    setSearchResults(results.map((r, i) => ({ ...r, sl: i + 1 })));
  };

  const stats = [
    { label: t.totalSales, value: todaySales.toLocaleString(), icon: Icons.Invoice, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t.stockQty, value: availableStock.length.toString(), icon: Icons.Stock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: t.profit, value: monthlyProfit.toLocaleString(), icon: Icons.Report, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-12">
      {/* Search Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{t.dashboard}</h2>
          <p className="text-slate-400 font-bold text-[9px] uppercase tracking-[0.4em] mt-2">{t.welcome}, <span className="text-slate-900">{data.shop.name}</span></p>
        </div>
        <form onSubmit={handleGlobalSearch} className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] focus-within:ring-2 ring-slate-200 transition-all">
          <div className="flex items-center px-4 text-slate-300"><Icons.Search /></div>
          <input 
            type="text" 
            placeholder="TRACK BY IMEI OR NAME..." 
            className="bg-transparent py-2.5 outline-none font-bold text-slate-900 text-[10px] uppercase tracking-widest w-full md:w-64" 
            value={imeiSearch} 
            onChange={e => {
              setImeiSearch(e.target.value);
              if (!e.target.value) {
                setSearchResults(null);
                setHasSearched(false);
              }
            }} 
          />
          <button type="submit" className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-[0.2em] shadow-lg active:scale-95 transition-all">TRACK</button>
        </form>
      </header>

      {/* Track Search Results Section - FIXED: NOW DISPLAYS SEARCH RESULTS */}
      {hasSearched && (
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center">
              <span className="w-1.5 h-3 bg-blue-500 rounded-full mr-3"></span>
              Tracking Logs for: <span className="ml-2 text-blue-600">"{imeiSearch}"</span>
            </h3>
            <button onClick={() => { setSearchResults(null); setHasSearched(false); setImeiSearch(''); }} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Clear Results</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">SL</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Log No.</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">IMEI / Serial</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Model</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Transaction</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Entity Name</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!searchResults || searchResults.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">No records found for this query</td>
                  </tr>
                ) : (
                  searchResults.map(res => (
                    <tr key={`${res.invoiceNo}-${res.serial}-${res.type}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-400 text-[10px]">{res.sl}</td>
                      <td className="px-6 py-4 font-black text-blue-600 text-[10px]">{res.invoiceNo}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 text-[10px]">{res.serial}</td>
                      <td className="px-6 py-4 font-bold text-slate-900 text-[10px] uppercase truncate max-w-[120px]">{res.modelNo}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${res.type === 'SALE' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                          {res.transaction}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-[10px] uppercase">{res.name}</p>
                        <p className="text-[8px] text-slate-400 font-bold">{res.mobile}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-500 text-[10px]">{res.date}</td>
                      <td className="px-6 py-4 text-center">
                        {res.type === 'SALE' ? (
                          <button onClick={() => setActiveTab('history', res.invoiceNo)} className="text-slate-400 hover:text-slate-900 transition-colors">
                            <Icons.Print />
                          </button>
                        ) : (
                          <button onClick={() => setActiveTab('stock')} className="text-slate-400 hover:text-slate-900 transition-colors">
                            <Icons.Stock />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.02)] border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] mb-3">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</p>
            </div>
            <div className={`absolute -top-4 -right-4 ${stat.bg} ${stat.color} p-8 rounded-full opacity-10 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500`}>
              <stat.icon />
            </div>
          </div>
        ))}
      </div>

      {/* Modules Grid */}
      <div className="space-y-6">
        <h3 className="text-[10px] font-black flex items-center text-slate-900 uppercase tracking-widest px-1">
          <span className="w-1.5 h-3 bg-slate-900 rounded-full mr-3"></span>
          System Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Sale Module Card */}
          <button 
            onClick={() => setActiveTab('invoice')}
            className="md:col-span-2 bg-slate-900 text-white p-8 rounded-[2rem] flex flex-col justify-between items-start text-left hover:bg-black group transition-all h-64 shadow-2xl shadow-slate-200 relative overflow-hidden"
          >
            <div className="bg-white/10 p-2.5 rounded-xl mb-4 transition-transform group-hover:scale-110">
              {/* Reduced Icon Container Size */}
              <div className="scale-90"><Icons.Sale /></div>
            </div>
            <div>
              <h4 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Process Sale</h4>
              <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest opacity-80">Create professional customer invoices</p>
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-700"></div>
          </button>
          
          <button 
            onClick={() => setActiveTab('stock')}
            className="bg-white p-8 rounded-[2.5rem] flex flex-col justify-between items-start text-left border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:border-slate-900 hover:shadow-xl group transition-all h-64"
          >
            <div className="bg-slate-50 p-2 rounded-xl mb-4 text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all">
              <div className="scale-75"><Icons.Stock /></div>
            </div>
            <div>
              <h4 className="text-lg font-black uppercase tracking-tight leading-none mb-2">Inventory</h4>
              <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">Real-time stock control</p>
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className="bg-white p-8 rounded-[2.5rem] flex flex-col justify-between items-start text-left border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:border-slate-900 hover:shadow-xl group transition-all h-64"
          >
            <div className="bg-slate-50 p-2 rounded-xl mb-4 text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all">
              <div className="scale-75"><Icons.Report /></div>
            </div>
            <div>
              <h4 className="text-lg font-black uppercase tracking-tight leading-none mb-2">Reports</h4>
              <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">Financial analytics</p>
            </div>
          </button>

          {/* Secondary Quick Actions */}
          <button onClick={() => setActiveTab('purchase')} className="bg-blue-50 text-blue-900 p-6 rounded-2xl flex flex-col justify-center items-center text-center border border-blue-100 hover:bg-blue-100 shadow-sm transition-all group">
            <div className="mb-2 scale-75 group-hover:scale-90 transition-transform"><Icons.Plus /></div>
            <span className="text-[9px] font-black uppercase tracking-widest">Inward Stock</span>
          </button>

          <button onClick={() => setActiveTab('models')} className="bg-slate-50 text-slate-900 p-6 rounded-2xl flex flex-col justify-center items-center text-center border border-slate-100 hover:bg-slate-100 shadow-sm transition-all group">
            <div className="mb-2 scale-75 group-hover:scale-90 transition-transform"><Icons.Catalog /></div>
            <span className="text-[9px] font-black uppercase tracking-widest">Product Catalog</span>
          </button>

          <button onClick={() => setActiveTab('settings')} className="bg-slate-50 text-slate-900 p-6 rounded-2xl flex flex-col justify-center items-center text-center border border-slate-100 hover:bg-slate-100 shadow-sm transition-all group">
            <div className="mb-2 scale-75 group-hover:scale-90 transition-transform"><Icons.Settings /></div>
            <span className="text-[9px] font-black uppercase tracking-widest">System Config</span>
          </button>

          <button onClick={() => setActiveTab('stock')} className="bg-amber-50 text-amber-900 p-6 rounded-2xl flex flex-col justify-center items-center text-center border border-amber-100 hover:bg-amber-100 shadow-sm transition-all group">
            <div className="mb-2 scale-75 group-hover:scale-90 transition-transform"><Icons.History /></div>
            <span className="text-[9px] font-black uppercase tracking-widest">Logs & History</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
