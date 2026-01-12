
import React, { useState, useMemo } from 'react';
import { AppData, StockStatus, IMEIStock, Invoice, Purchase } from '../types';
import { Icons } from '../constants';
import InvoiceHistory from './InvoiceHistory';

interface Props {
  data: AppData;
  initialTab?: 'available' | 'purchase_history' | 'sales_history';
  onSubTabChange?: (tab: 'available' | 'purchase_history' | 'sales_history') => void;
  onUpdateStock: (oldImei: string, updatedStock: IMEIStock) => void;
  onDeleteStock: (imei: string) => void;
  onDeletePurchase: (id: string) => void;
  onUpdatePurchase: (p: Purchase) => void;
  // History Props
  initialInvoiceId: string | null;
  onClearInitial: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
}

const formatAmount = (val: number) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StockManagement: React.FC<Props> = ({ 
  data, 
  initialTab = 'available', 
  onSubTabChange,
  onUpdateStock, 
  onDeleteStock,
  onDeletePurchase,
  onUpdatePurchase,
  initialInvoiceId,
  onClearInitial,
  onEditInvoice,
  onDeleteInvoice
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'available' | 'purchase_history' | 'sales_history'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStock, setEditingStock] = useState<IMEIStock | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deleteImei, setDeleteImei] = useState<string | null>(null);
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null);

  React.useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  const handleSubTabClick = (tab: 'available' | 'purchase_history' | 'sales_history') => {
    setActiveSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  const models = data.models || [];
  const stocks = data.stocks || [];
  const purchases = data.purchases || [];

  const filteredStock = useMemo(() => {
    return stocks.filter(stock => {
      const model = models.find(m => m.id === stock.modelId);
      const searchLow = searchTerm.toLowerCase();
      const isAvailable = stock.status === StockStatus.AVAILABLE;
      return isAvailable && (
        stock.imei.includes(searchTerm) || 
        model?.modelName.toLowerCase().includes(searchLow) ||
        model?.brand.toLowerCase().includes(searchLow)
      );
    });
  }, [stocks, models, searchTerm]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => 
      (p.supplierName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice().reverse();
  }, [purchases, searchTerm]);

  const generatePurchasePDF = (p: Purchase) => {
    try {
      const { jsPDF } = (window as any).jspdf;
      if (!jsPDF) return;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const MARGIN = 15;
      const PAGE_WIDTH = doc.internal.pageSize.getWidth();
      const FONT = "helvetica";
      const safeText = (text: any, x: number, y: number, o?: any) => doc.text(String(text || ""), Number(x), Number(y), o);

      doc.setTextColor(0, 0, 0); doc.setFont(FONT, "bold"); doc.setFontSize(24);
      safeText(String(data.shop.name || 'SHOP NAME').toUpperCase(), PAGE_WIDTH / 2, 18, { align: 'center' });
      doc.setFontSize(14); doc.rect(PAGE_WIDTH / 2 - 25, 35, 50, 8); safeText("PURCHASE NOTE", PAGE_WIDTH / 2, 41, { align: 'center' });

      const metaY = 55; doc.setFontSize(10); doc.setFont(FONT, "bold");
      safeText("Supplier", MARGIN, metaY); safeText(`: ${p.supplierName}`, MARGIN + 20, metaY);
      safeText("Phone", MARGIN, metaY + 7); safeText(`: ${p.supplierPhone}`, MARGIN + 20, metaY + 7);
      
      const boxW = 80; const boxX = PAGE_WIDTH - MARGIN - boxW;
      doc.rect(boxX, metaY - 5, boxW, 25);
      safeText("PUR NO.", boxX + 2, metaY); safeText(p.purchaseNumber, boxX + 35, metaY);
      safeText("DATE", boxX + 2, metaY + 7); safeText(new Date(p.date).toLocaleDateString(), boxX + 35, metaY + 7);

      const itData = p.items.map((item, i) => [i + 1, `${item.brand} ${item.modelName}`, item.imeis.length, item.costPrice.toLocaleString(), (item.costPrice * item.imeis.length).toLocaleString()]);
      (doc as any).autoTable({
        startY: metaY + 25, margin: { left: MARGIN, right: MARGIN },
        head: [['SL', 'MODEL', 'QTY', 'UNIT COST', 'TOTAL']],
        body: itData, theme: 'grid', styles: { fontSize: 9, font: FONT }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont(FONT, "bold"); safeText("NET PAYABLE", PAGE_WIDTH - MARGIN - 70, finalY);
      safeText(p.total.toLocaleString(), PAGE_WIDTH - MARGIN, finalY, { align: 'right' });
      
      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Inventory Control</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Centralized Stock & History Management</p>
        </div>
      </div>

      <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 gap-2">
        {[
          { id: 'available', label: 'Available Stock', icon: Icons.Stock },
          { id: 'purchase_history', label: 'Purchase History', icon: Icons.Plus },
          { id: 'sales_history', label: 'Sales History', icon: Icons.History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleSubTabClick(tab.id as any)}
            className={`flex-1 flex items-center justify-center space-x-3 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              activeSubTab === tab.id 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-100' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeSubTab === 'available' && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
          <div className="p-6 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
                <div className="text-slate-300"><Icons.Search /></div>
                <input 
                  type="text" 
                  placeholder="FILTER AVAILABLE STOCK..." 
                  className="flex-1 bg-transparent py-2 outline-none font-bold text-[10px] tracking-widest text-slate-900 placeholder:text-slate-300"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-4 border-l">
                {filteredStock.length} Units In Stock
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">IMEI / S/N</th>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Device Model</th>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Pricing (C / S)</th>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.4em]">No available stock matches</td>
                  </tr>
                ) : (
                  filteredStock.sort((a,b) => (b.dateAdded || "").localeCompare(a.dateAdded || "")).map(stock => {
                    const model = models.find(m => m.id === stock.modelId);
                    return (
                      <tr key={stock.imei} className="hover:bg-slate-50/50 transition-all group">
                        <td className="px-8 py-5">
                          <span className="font-mono text-xs font-black text-slate-900 tracking-tight">{stock.imei}</span>
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-black text-slate-900 text-[11px] uppercase tracking-tight">{model?.brand} {model?.modelName}</p>
                          <p className="text-slate-400 font-black text-[8px] uppercase tracking-widest">Added: {new Date(stock.dateAdded).toLocaleDateString()}</p>
                        </td>
                        <td className="px-8 py-5 text-right font-black text-xs">
                          <span className="text-slate-300">{stock.purchasePrice.toLocaleString()}</span>
                          <span className="mx-2 text-slate-100">/</span>
                          <span className="text-slate-900">{stock.sellingPrice.toLocaleString()}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex justify-center items-center space-x-3 text-slate-300">
                            <button onClick={() => alert('Printing barcode for ' + stock.imei)} className="hover:text-slate-900 transition-colors"><Icons.Print /></button>
                            <button onClick={() => setEditingStock(stock)} className="hover:text-blue-600 transition-colors"><Icons.Settings /></button>
                            <button onClick={() => setDeleteImei(stock.imei)} className="hover:text-rose-500 transition-colors"><Icons.Trash /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'purchase_history' && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
          <div className="p-6 border-b border-slate-50 bg-slate-50/20 flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
                <div className="text-slate-300"><Icons.Search /></div>
                <input 
                  type="text" 
                  placeholder="SEARCH PURCHASES BY SUPPLIER OR NO..." 
                  className="flex-1 bg-transparent py-2 outline-none font-bold text-[10px] tracking-widest text-slate-900 placeholder:text-slate-300"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Purchase No</th>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Date</th>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Supplier</th>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Amount</th>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Due</th>
                  <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.4em]">No purchase records found</td>
                  </tr>
                ) : (
                  filteredPurchases.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-8 py-5 font-black text-blue-600 text-xs uppercase">{p.purchaseNumber}</td>
                      <td className="px-8 py-5 text-slate-500 font-bold text-xs">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-900 text-xs">{p.supplierName || 'Unknown Supplier'}</p>
                        <p className="text-[9px] text-slate-400 font-bold">{p.supplierPhone}</p>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-slate-900 text-xs">{p.total.toLocaleString()}</td>
                      <td className="px-8 py-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${p.dueAmount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {p.dueAmount > 0 ? p.dueAmount.toLocaleString() : 'Paid'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex justify-center items-center space-x-3 text-slate-300">
                          <button onClick={() => generatePurchasePDF(p)} className="hover:text-slate-900 transition-colors"><Icons.Print /></button>
                          <button onClick={() => setEditingPurchase(p)} className="hover:text-blue-600 transition-colors"><Icons.Settings /></button>
                          <button onClick={() => setDeletePurchaseId(p.id)} className="hover:text-rose-500 transition-colors"><Icons.Trash /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'sales_history' && (
        <InvoiceHistory 
          data={data} 
          initialInvoiceId={initialInvoiceId} 
          onClearInitial={onClearInitial} 
          onEditInvoice={onEditInvoice} 
          onDeleteInvoice={onDeleteInvoice} 
        />
      )}

      {/* Modals */}
      {editingStock && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] max-w-md w-full p-10 shadow-2xl border border-slate-100 animate-in zoom-in duration-300">
             <h3 className="text-2xl font-black text-slate-900 uppercase mb-6 tracking-tighter">Adjust Unit Pricing</h3>
             <div className="space-y-4 mb-10">
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Purchase Cost</label>
                 <input type="number" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-slate-900" value={editingStock.purchasePrice} onChange={e => setEditingStock({...editingStock, purchasePrice: Number(e.target.value)})} />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Selling Retail</label>
                 <input type="number" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-slate-900" value={editingStock.sellingPrice} onChange={e => setEditingStock({...editingStock, sellingPrice: Number(e.target.value)})} />
               </div>
             </div>
             <div className="flex flex-col gap-3">
               <button onClick={() => { onUpdateStock(editingStock.imei, editingStock); setEditingStock(null); }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Update Pricing</button>
               <button onClick={() => setEditingStock(null)} className="w-full bg-slate-50 text-slate-400 py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Discard</button>
             </div>
           </div>
        </div>
      )}

      {editingPurchase && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] max-w-md w-full p-10 shadow-2xl border border-slate-100 animate-in zoom-in duration-300">
             <h3 className="text-2xl font-black text-slate-900 uppercase mb-6 tracking-tighter">Update Purchase</h3>
             <div className="space-y-4 mb-10">
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Supplier Name</label>
                 <input type="text" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-slate-900" value={editingPurchase.supplierName} onChange={e => setEditingPurchase({...editingPurchase, supplierName: e.target.value})} />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Remaining Due Amount</label>
                 <input type="number" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-slate-900" value={editingPurchase.dueAmount} onChange={e => setEditingPurchase({...editingPurchase, dueAmount: Number(e.target.value)})} />
               </div>
             </div>
             <div className="flex flex-col gap-3">
               <button onClick={() => { onUpdatePurchase(editingPurchase); setEditingPurchase(null); }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Save Changes</button>
               <button onClick={() => setEditingPurchase(null)} className="w-full bg-slate-50 text-slate-400 py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Discard</button>
             </div>
           </div>
        </div>
      )}

      {deleteImei && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-10 shadow-2xl border border-slate-100 animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 uppercase mb-4 tracking-tighter text-center">Remove Unit?</h3>
            <p className="text-slate-400 text-[11px] text-center mb-8 font-bold uppercase tracking-widest leading-relaxed">This IMEI record will be purged from the inventory forever.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { onDeleteStock(deleteImei); setDeleteImei(null); }} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Yes, Delete</button>
              <button onClick={() => setDeleteImei(null)} className="w-full bg-slate-50 text-slate-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {deletePurchaseId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-10 shadow-2xl border-4 border-rose-500 animate-in zoom-in duration-200 text-center">
            <h3 className="text-xl font-black text-slate-900 uppercase mb-4 tracking-tighter">Wipe Purchase?</h3>
            <p className="text-slate-400 text-[11px] mb-8 font-bold uppercase tracking-widest leading-relaxed">Warning: This only removes the procurement record. Associated stock remains in system.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { onDeletePurchase(deletePurchaseId); setDeletePurchaseId(null); }} className="w-full bg-rose-600 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Purge Record</button>
              <button onClick={() => setDeletePurchaseId(null)} className="w-full bg-slate-100 text-slate-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
