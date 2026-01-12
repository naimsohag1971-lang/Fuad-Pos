
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

const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    const val = Math.floor(n);
    if (val < 20) return a[val];
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '');
    if (val < 1000) return convert(Math.floor(val / 100)) + 'Hundred ' + (val % 100 !== 0 ? 'and ' + convert(val % 100) : '');
    if (val < 100000) return convert(Math.floor(val / 1000)) + 'Thousand ' + (val % 1000 !== 0 ? convert(val % 1000) : '');
    if (val < 10000000) return convert(Math.floor(val / 100000)) + 'Lakh ' + (val % 100000 !== 0 ? convert(val % 100000) : '');
    return 'Amount too large';
  };
  if (num === 0) return 'Zero';
  return convert(num).trim() + ' Only';
};

const Dashboard: React.FC<Props> = ({ data, setActiveTab, onEditInvoice, onDeleteInvoice, translations: t }) => {
  const [imeiSearch, setImeiSearch] = useState('');
  const [searchResults, setSearchResults] = useState<TrackRecord[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [previewItem, setPreviewItem] = useState<TrackRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isProfileIncomplete = !data.shop.address || !data.shop.phone || !data.shop.preparedBy;

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  const todayInvoices = data.invoices.filter(inv => inv.date.startsWith(today));
  const monthlyInvoices = data.invoices.filter(inv => inv.date.startsWith(thisMonth));

  const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const monthlySales = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const availableStock = data.stocks.filter(s => s.status === StockStatus.AVAILABLE);
  const totalStockValue = availableStock.reduce((sum, stock) => sum + (stock.purchasePrice || 0), 0);

  const monthlyProfit = monthlyInvoices.reduce((acc, inv) => {
    const cost = inv.items.reduce((itemSum, item) => {
      const stockEntry = data.stocks.find(s => s.imei === item.imei);
      return itemSum + (stockEntry?.purchasePrice || 0);
    }, 0);
    return acc + (inv.total - cost);
  }, 0);

  const generatePDF = (invoice: Invoice) => {
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
      doc.setFontSize(9); doc.setFont(FONT, "normal");
      safeText(String(data.shop.address || ''), PAGE_WIDTH / 2, 23, { align: 'center' });
      doc.setFont(FONT, "bold"); safeText(`Mobile : ${String(data.shop.phone || '')}`, PAGE_WIDTH / 2, 28, { align: 'center' });
      doc.setFontSize(14); doc.rect(PAGE_WIDTH / 2 - 25, 35, 50, 8); safeText("SALES INVOICE", PAGE_WIDTH / 2, 41, { align: 'center' });

      const metaY = 55; doc.setFontSize(10); doc.setFont(FONT, "bold");
      safeText("Customer", MARGIN, metaY); safeText("Address", MARGIN, metaY + 7); safeText("Mobile", MARGIN, metaY + 14);
      safeText(`: ${invoice.customerName}`, MARGIN + 20, metaY);
      doc.setFont(FONT, "normal"); safeText(`: ${invoice.customerAddress || 'N/A'}`, MARGIN + 20, metaY + 7); safeText(`: ${invoice.customerPhone}`, MARGIN + 20, metaY + 14);

      const boxW = 80; const boxX = PAGE_WIDTH - MARGIN - boxW;
      doc.rect(boxX, metaY - 5, boxW, 25);
      const mRows = [["INV NO.", invoice.invoiceNumber], ["DATE", new Date(invoice.date).toLocaleDateString()], ["BILL STATUS", invoice.dueAmount <= 0 ? "PAID" : "DUE"]];
      mRows.forEach((r, i) => {
        const rowY = metaY + (i * 6);
        doc.setFont(FONT, "bold"); doc.setFontSize(9); safeText(String(r[0]), boxX + 2, rowY);
        doc.setFont(FONT, "normal"); safeText(String(r[1]), boxX + 35, rowY);
      });

      const itData = invoice.items.map((item, i) => [i + 1, `${item.brand} ${item.modelName}\nS/N: ${item.imei}`, `1.00`, formatAmount(item.price), formatAmount(item.price)]);
      (doc as any).autoTable({
        startY: metaY + 25, margin: { left: MARGIN, right: MARGIN },
        head: [['SL', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT']],
        body: itData, theme: 'grid', styles: { fontSize: 9, font: FONT }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont(FONT, "bold"); safeText("NET PAYABLE", PAGE_WIDTH - MARGIN - 70, finalY);
      safeText(formatAmount(invoice.total), PAGE_WIDTH - MARGIN, finalY, { align: 'right' });
      
      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { console.error(e); }
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = imeiSearch.trim().toLowerCase();
    if (!query) return;

    const results: TrackRecord[] = [];
    setHasSearched(true);

    const matchedStocks = data.stocks.filter(s => s.imei.toLowerCase().includes(query));
    const matchedInvoices = data.invoices.filter(inv => inv.invoiceNumber.toLowerCase().includes(query) || inv.customerName.toLowerCase().includes(query));

    matchedStocks.forEach(stock => {
      const model = data.models.find(m => m.id === stock.modelId);
      const purchaseRecord = data.purchases.find(p => p.id === stock.purchaseId);
      const supplierName = purchaseRecord ? purchaseRecord.supplierName : 'Main Supplier';

      results.push({
        sl: 0,
        invoiceNo: purchaseRecord ? purchaseRecord.purchaseNumber : `PUR-${stock.imei.slice(-6).toUpperCase()}`,
        branchName: data.shop.name,
        serial: stock.imei,
        date: new Date(stock.dateAdded).toLocaleDateString('en-GB'),
        transaction: 'Stock Purchase',
        name: supplierName,
        mobile: purchaseRecord?.supplierPhone || '',
        modelNo: `${model?.brand} ${model?.modelName}`,
        type: 'PURCHASE'
      });

      if (stock.status === StockStatus.SOLD) {
        const inv = data.invoices.find(i => i.items.some(it => it.imei === stock.imei));
        if (inv) {
          results.push({
            sl: 0,
            invoiceNo: inv.invoiceNumber,
            branchName: data.shop.name,
            serial: stock.imei,
            date: new Date(inv.date).toLocaleDateString('en-GB'),
            transaction: 'Credit Sales',
            name: inv.customerName,
            mobile: inv.customerPhone,
            modelNo: `${model?.brand} ${model?.modelName}`,
            type: 'SALE',
            originalInvoice: inv
          });
        }
      }
    });

    matchedInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!results.some(r => r.invoiceNo === inv.invoiceNumber && r.serial === item.imei)) {
          results.push({
            sl: 0,
            invoiceNo: inv.invoiceNumber,
            branchName: data.shop.name,
            serial: item.imei,
            date: new Date(inv.date).toLocaleDateString('en-GB'),
            transaction: 'Credit Sales',
            name: inv.customerName,
            mobile: inv.customerPhone,
            modelNo: `${item.brand} ${item.modelName}`,
            type: 'SALE',
            originalInvoice: inv
          });
        }
      });
    });

    setSearchResults(results.length > 0 ? results.map((r, i) => ({ ...r, sl: i + 1 })) : []);
  };

  const stats = [
    { label: t.totalSales, value: todaySales.toLocaleString(), icon: Icons.Invoice, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: t.monthlySales, value: monthlySales.toLocaleString(), icon: Icons.Invoice, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: t.stockQty, value: availableStock.length.toString(), icon: Icons.Stock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: t.stockValue, value: totalStockValue.toLocaleString(), icon: Icons.Report, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: t.todayInvoices, value: todayInvoices.length.toString(), icon: Icons.Dashboard, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
    { label: t.profit, value: monthlyProfit.toLocaleString(), icon: Icons.Report, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
  ];

  const handleDelete = () => {
    if (deleteId) {
      onDeleteInvoice(deleteId);
      setSearchResults(prev => prev ? prev.filter(r => r.invoiceNo !== deleteId) : null);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{t.dashboard}</h2>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">{t.welcome}, <span className="text-slate-900">{data.shop.name}</span></p>
        </div>
        
        <div className="w-full md:w-auto">
          <form onSubmit={handleGlobalSearch} className="flex bg-white p-1.5 rounded-3xl border border-slate-100 shadow-sm focus-within:shadow-2xl focus-within:border-slate-300 transition-all group">
            <div className="flex items-center px-4 text-slate-300 group-focus-within:text-slate-900 transition-colors">
              <Icons.Search />
            </div>
            <input 
              type="text" 
              placeholder="TRACK IMEI, BILL, NAME..." 
              className="bg-transparent py-3 outline-none font-black text-slate-900 text-[11px] uppercase tracking-widest w-full md:w-64 placeholder:text-slate-200"
              value={imeiSearch}
              onChange={e => setImeiSearch(e.target.value)}
            />
            <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-[9px] tracking-[0.2em] active:scale-95 transition-all shadow-lg shadow-slate-200">
              TRACK
            </button>
          </form>
        </div>
      </header>

      {hasSearched && searchResults && (
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
             <div className="flex items-center space-x-3">
               <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
               <h3 className="text-xs font-black uppercase tracking-[0.3em]">Lifecycle Tracking Ledger</h3>
             </div>
             <button onClick={() => { setHasSearched(false); setSearchResults(null); }} className="text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Clear Search</button>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-[10px] font-bold border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-4 text-center border-r">SL</th>
                  <th className="px-4 py-4 text-left border-r">Invoice No</th>
                  <th className="px-4 py-4 text-left border-r">Serial</th>
                  <th className="px-4 py-4 text-left border-r">Date</th>
                  <th className="px-4 py-4 text-left border-r">Transaction</th>
                  <th className="px-4 py-4 text-left border-r">Name</th>
                  <th className="px-4 py-4 text-left border-r">Mobile</th>
                  <th className="px-4 py-4 text-left border-r">Model No</th>
                  <th className="px-4 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {searchResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center text-slate-300 font-black uppercase text-[12px] tracking-[0.5em]">No system records found for this query</td>
                  </tr>
                ) : (
                  searchResults.map((rec) => (
                    <tr key={`${rec.invoiceNo}-${rec.serial}-${rec.type}`} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-3 text-center border-r font-black text-slate-400">{rec.sl}</td>
                      <td className="px-4 py-3 border-r font-black text-blue-600 whitespace-nowrap">
                        <button 
                          onClick={() => {
                            if (rec.type === 'SALE') {
                              setActiveTab('history', rec.originalInvoice?.id);
                            } else {
                              setActiveTab('purchase_history');
                            }
                          }}
                          className="hover:underline transition-all"
                        >
                          {rec.invoiceNo}
                        </button>
                      </td>
                      <td className="px-4 py-3 border-r font-mono font-black text-slate-900">{rec.serial}</td>
                      <td className="px-4 py-3 border-r whitespace-nowrap">{rec.date}</td>
                      <td className="px-4 py-3 border-r">
                         <span className={`px-2 py-0.5 rounded text-[8px] uppercase ${rec.transaction.includes('Purchase') ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                           {rec.transaction}
                         </span>
                      </td>
                      <td className="px-4 py-3 border-r uppercase whitespace-nowrap font-bold text-slate-900">{rec.name}</td>
                      <td className="px-4 py-3 border-r">{rec.mobile}</td>
                      <td className="px-4 py-3 border-r uppercase whitespace-nowrap text-slate-900">{rec.modelNo}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-3 text-slate-300">
                          <button 
                            onClick={() => rec.type === 'SALE' && rec.originalInvoice && generatePDF(rec.originalInvoice)} 
                            className="hover:text-slate-900 transition-colors"
                            title="Print PDF"
                          >
                            <Icons.Print />
                          </button>
                          <button 
                            onClick={() => {
                              if (rec.type === 'SALE' && rec.originalInvoice) {
                                onEditInvoice(rec.originalInvoice);
                              } else {
                                setActiveTab('stock');
                              }
                            }} 
                            className="hover:text-blue-600 transition-colors"
                            title="Edit Record"
                          >
                            <Icons.Settings />
                          </button>
                          <button 
                            onClick={() => {
                              if (rec.type === 'SALE' && rec.originalInvoice) {
                                setDeleteId(rec.originalInvoice.id);
                              } else {
                                alert("Direct stock deletion is done in Inventory module.");
                              }
                            }} 
                            className="hover:text-rose-500 transition-colors"
                            title="Delete"
                          >
                            <Icons.Trash />
                          </button>
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

      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-10 shadow-2xl border-4 border-rose-500 animate-in zoom-in duration-200 text-center">
             <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Icons.Trash />
             </div>
             <h3 className="text-2xl font-black text-slate-900 uppercase mb-2 tracking-tighter">Destroy Entry?</h3>
             <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed mb-10">This will permanently purge this transaction from history.</p>
             <div className="flex flex-col gap-3">
               <button onClick={handleDelete} className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Confirm Delete</button>
               <button onClick={() => setDeleteId(null)} className="w-full bg-slate-100 text-slate-400 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
             </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className={`bg-white p-6 rounded-[2rem] shadow-sm border ${stat.border} hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group overflow-hidden relative`}>
             <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
              </div>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl transition-transform group-hover:rotate-12 duration-300 shadow-sm`}><stat.icon /></div>
            </div>
            <div className={`absolute -bottom-4 -right-4 w-12 h-12 ${stat.bg} rounded-full opacity-30 group-hover:scale-[4] transition-transform duration-700`}></div>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-50">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-sm font-black flex items-center text-slate-900 uppercase tracking-widest">
            <span className="w-1.5 h-4 bg-slate-900 rounded-full mr-3"></span>
            System Modules
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { id: 'invoice', label: t.invoice, icon: Icons.Sale, color: 'bg-slate-900' },
            { id: 'stock', label: 'Inventory', icon: Icons.Stock, color: 'bg-slate-50' },
            { id: 'history', label: t.history, icon: Icons.History, color: 'bg-slate-50' },
            { id: 'reports', label: 'Analytics', icon: Icons.Report, color: 'bg-slate-50' },
            { id: 'settings', label: 'System', icon: Icons.Settings, color: 'bg-slate-50' },
            { id: 'models', label: 'Catalog', icon: Icons.Catalog, color: 'bg-slate-50' },
          ].map((item) => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id === 'history' ? 'stock' : item.id as any)} 
              className={`flex flex-col items-center p-6 rounded-[2rem] border transition-all group active:scale-95 ${
                item.color === 'bg-slate-900' 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200 hover:bg-black' 
                  : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <div className={`p-3 rounded-xl mb-3 transition-all group-hover:scale-110 ${item.color === 'bg-slate-900' ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`}>
                <item.icon />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-center">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
