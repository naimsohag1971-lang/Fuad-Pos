
import React, { useState } from 'react';
import { AppData, StockStatus, Invoice } from '../types';
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

const Dashboard: React.FC<Props> = ({ data, setActiveTab, onEditInvoice, onDeleteInvoice, translations: t }) => {
  const [imeiSearch, setImeiSearch] = useState('');
  const [searchResults, setSearchResults] = useState<TrackRecord[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  // Stats Logic
  const todayInvoices = data.invoices.filter(inv => inv.date.startsWith(today));
  const monthlyInvoices = data.invoices.filter(inv => inv.date.startsWith(thisMonth));

  const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const monthlySales = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const getProfit = (invoices: Invoice[]) => invoices.reduce((acc, inv) => {
    const cost = inv.items.reduce((itemSum, item) => {
      const stockEntry = data.stocks.find(s => s.imei === item.imei);
      return itemSum + (stockEntry?.purchasePrice || 0);
    }, 0);
    return acc + (inv.total - cost);
  }, 0);

  const todayProfit = getProfit(todayInvoices);
  const monthlyProfit = getProfit(monthlyInvoices);

  const availableStock = data.stocks.filter(s => s.status === StockStatus.AVAILABLE);
  const stockValue = availableStock.reduce((sum, s) => sum + (s.purchasePrice || 0), 0);

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

    const matchedStocks = data.stocks.filter(s => s.imei.toLowerCase().includes(query));
    matchedStocks.forEach(stock => {
      const model = data.models.find(m => m.id === stock.modelId);
      const purchaseRecord = data.purchases.find(p => p.id === stock.purchaseId);
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

      if (stock.status === StockStatus.SOLD) {
        const inv = data.invoices.find(i => i.items.some(it => it.imei === stock.imei));
        if (inv) {
          results.push({ 
            sl: 0, invoiceNo: inv.invoiceNumber, branchName: data.shop.name, serial: stock.imei, 
            date: new Date(inv.date).toLocaleDateString(), transaction: 'Sale', name: inv.customerName, 
            mobile: inv.customerPhone, modelNo: model ? `${model.brand} ${model.modelName}` : "N/A", 
            type: 'SALE', originalInvoice: inv 
          });
        }
      }
    });

    data.invoices.filter(inv => inv.invoiceNumber.toLowerCase().includes(query) || inv.customerName.toLowerCase().includes(query) || inv.customerPhone.includes(query))
      .forEach(inv => {
        inv.items.forEach(item => {
          if (!results.some(r => r.invoiceNo === inv.invoiceNumber && r.serial === item.imei)) {
            results.push({ 
              sl: 0, invoiceNo: inv.invoiceNumber, branchName: data.shop.name, serial: item.imei, 
              date: new Date(inv.date).toLocaleDateString(), transaction: 'Sale', name: inv.customerName, 
              mobile: inv.customerPhone, modelNo: `${item.brand} ${item.modelName}`, type: 'SALE', originalInvoice: inv 
            });
          }
        });
      });
    setSearchResults(results.map((r, i) => ({ ...r, sl: i + 1 })));
  };

  const stats = [
    { label: 'Today Sales', value: todaySales, icon: Icons.Sale, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Monthly Sales', value: monthlySales, icon: Icons.Invoice, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Today Profit', value: todayProfit, icon: Icons.Report, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Monthly Profit', value: monthlyProfit, icon: Icons.Report, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Stock Qty', value: availableStock.length, icon: Icons.Stock, color: 'text-amber-600', bg: 'bg-amber-50', isQty: true },
    { label: 'Stock Value', value: stockValue, icon: Icons.Catalog, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const modules = [
    { id: 'purchase', label: 'Purchase', icon: Icons.Plus, color: 'bg-blue-600' },
    { id: 'invoice', label: 'Sale (Billing)', icon: Icons.Sale, color: 'bg-emerald-600' },
    { id: 'stock', label: 'Inventory', icon: Icons.Stock, color: 'bg-slate-900' },
    { id: 'models', label: 'Catalog', icon: Icons.Catalog, color: 'bg-indigo-600' },
    { id: 'reports', label: 'Analytics', icon: Icons.Report, color: 'bg-amber-600' },
    { id: 'settings', label: 'Settings', icon: Icons.Settings, color: 'bg-slate-500' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="text-left">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{t.dashboard}</h2>
          <p className="text-slate-400 font-bold text-[9px] uppercase tracking-[0.4em] mt-2">{t.welcome}, <span className="text-slate-900">{data.shop.name}</span></p>
        </div>
        <form onSubmit={handleGlobalSearch} className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 ring-slate-200 transition-all">
          <div className="flex items-center px-4 text-slate-300"><Icons.Search /></div>
          <input type="text" placeholder="TRACK IMEI OR NAME..." className="bg-transparent py-2.5 outline-none font-bold text-slate-900 text-[10px] uppercase tracking-widest w-full md:w-64" value={imeiSearch} onChange={e => { setImeiSearch(e.target.value); if (!e.target.value) { setSearchResults(null); setHasSearched(false); } }} />
          <button type="submit" className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-[0.2em] shadow-lg active:scale-95 transition-all">TRACK</button>
        </form>
      </header>

      {hasSearched && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-top-4 duration-500 text-left">
          <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Tracking Logs: <span className="text-blue-600">"{imeiSearch}"</span></h3>
            <button onClick={() => { setSearchResults(null); setHasSearched(false); setImeiSearch(''); }} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">Clear Results</button>
          </div>
          <div className="overflow-x-auto max-h-60 custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Log No.</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">IMEI</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Model</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Entity</th>
                  <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!searchResults || searchResults.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">No records found</td></tr>
                ) : (
                  searchResults.map((res, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-black text-blue-600 text-[10px]">{res.invoiceNo}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 text-[10px]">{res.serial}</td>
                      <td className="px-6 py-4 font-bold text-slate-900 text-[10px] uppercase truncate max-w-[120px]">{res.modelNo}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${res.type === 'SALE' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{res.transaction}</span></td>
                      <td className="px-6 py-4"><p className="font-bold text-slate-900 text-[10px] uppercase">{res.name}</p></td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => res.type === 'SALE' ? setActiveTab('history', res.invoiceNo) : setActiveTab('stock')} className="text-slate-400 hover:text-slate-900"><Icons.Print /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-left">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-2 truncate">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 tracking-tight">{stat.isQty ? stat.value : stat.value.toLocaleString()}</p>
            </div>
            <div className={`absolute -bottom-2 -right-2 ${stat.bg} ${stat.color} p-4 rounded-full opacity-5 group-hover:opacity-20 transition-all duration-500 scale-150`}>
              <stat.icon />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <h3 className="text-[9px] font-black flex items-center text-slate-900 uppercase tracking-widest px-1">
          <span className="w-1 h-3 bg-slate-900 rounded-full mr-2"></span>
          System Modules
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {modules.map((mod) => (
            <button 
              key={mod.id}
              onClick={() => setActiveTab(mod.id)}
              className="bg-white p-5 rounded-[2rem] border border-slate-100 hover:border-slate-900 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col items-center text-center justify-center space-y-3"
            >
              <div className={`${mod.color} p-3 rounded-2xl text-white shadow-lg shadow-slate-200 transition-transform group-hover:scale-110`}>
                <div className="scale-90"><mod.icon /></div>
              </div>
              <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{mod.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
