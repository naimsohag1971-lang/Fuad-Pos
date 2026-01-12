
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Invoice, PaymentMethod } from '../types';
import { Icons } from '../constants';

const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    const val = Math.floor(n);
    if (val < 0) return 'Negative ' + convert(Math.abs(val));
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

const formatAmount = (val: number) => (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  data: AppData;
  initialInvoiceId: string | null;
  onClearInitial?: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
}

const InvoiceHistory: React.FC<Props> = ({ data, initialInvoiceId, onClearInitial, onEditInvoice, onDeleteInvoice }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'DUE'>('ALL');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (initialInvoiceId) {
      const inv = data.invoices.find(i => i.id === initialInvoiceId);
      if (inv) setSelectedInvoice(inv);
      onClearInitial?.();
    }
  }, [initialInvoiceId, data.invoices, onClearInitial]);

  const filteredInvoices = useMemo(() => {
    return data.invoices.filter(inv => {
      const matchesSearch = (inv.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) || (inv.invoiceNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) || (inv.customerPhone || "").includes(searchQuery);
      const invDate = new Date(inv.date).setHours(0,0,0,0);
      const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
      const end = endDate ? new Date(endDate).setHours(0,0,0,0) : null;
      const matchesDate = (!start || invDate >= start) && (!end || invDate <= end);
      const isPaid = inv.dueAmount <= 0;
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'PAID' && isPaid) || (statusFilter === 'DUE' && !isPaid);
      return matchesSearch && matchesDate && matchesStatus;
    }).slice().reverse();
  }, [data.invoices, searchQuery, startDate, endDate, statusFilter]);

  const generatePDF = (invoice: Invoice) => {
    try {
      const { jsPDF } = (window as any).jspdf;
      if (!jsPDF) return;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const MARGIN = 15; 
      const PAGE_WIDTH = doc.internal.pageSize.getWidth();
      const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
      const FONT = "helvetica";
      const n = (val: any) => isFinite(Number(val)) ? Number(val) : 0;
      const safeText = (text: any, x: number, y: number, o?: any) => doc.text(String(text || ""), n(x), n(y), o);

      // Header
      doc.setTextColor(0, 0, 0); doc.setFont(FONT, "bold"); doc.setFontSize(24);
      safeText(String(data.shop.name || 'SHOP NAME').toUpperCase(), PAGE_WIDTH / 2, 18, { align: 'center' });
      doc.setFontSize(9); doc.setFont(FONT, "normal");
      safeText(String(data.shop.address || ''), PAGE_WIDTH / 2, 23, { align: 'center' });
      doc.setFont(FONT, "bold"); safeText(`Mobile : ${String(data.shop.phone || '')}`, PAGE_WIDTH / 2, 28, { align: 'center' });
      doc.setFontSize(14); doc.rect(n(PAGE_WIDTH / 2 - 25), 35, 50, 8); safeText("SALES INVOICE", PAGE_WIDTH / 2, 41, { align: 'center' });

      // Info Labels
      const metaY = 55; doc.setFontSize(10); doc.setFont(FONT, "bold");
      safeText("Customer", MARGIN, metaY); safeText("Address", MARGIN, metaY + 7); safeText("Mobile", MARGIN, metaY + 14); safeText("Attention", MARGIN, metaY + 21);
      doc.setFont(FONT, "bold"); safeText(`: ${invoice.customerName}`, MARGIN + 20, metaY);
      doc.setFont(FONT, "normal"); safeText(`: ${invoice.customerAddress || 'N/A'}`, MARGIN + 20, metaY + 7); safeText(`: ${invoice.customerPhone}`, MARGIN + 20, metaY + 14); safeText(`: ${invoice.attention || ''}`, MARGIN + 20, metaY + 21);

      // Info Box (Invoice Details)
      const boxW = 80; const boxX = PAGE_WIDTH - MARGIN - boxW;
      doc.setLineWidth(0.3); doc.rect(n(boxX), n(metaY - 5), n(boxW), 30);
      
      const firstPayment = invoice.payments?.[0];
      let pMethodStr = (firstPayment?.method || "CASH").toUpperCase();
      if (firstPayment?.method === PaymentMethod.CARD && firstPayment.bankName) pMethodStr += ` (${firstPayment.bankName.toUpperCase()})`;
      else if (firstPayment?.paymentPhone) pMethodStr += ` (${firstPayment.paymentPhone})`;

      const mRows = [
        ["INVOICE NO.", invoice.invoiceNumber],
        ["DATE", new Date(invoice.date).toLocaleDateString('en-GB')],
        ["PREPARED BY", (data.shop.preparedBy || "SOHAG").toUpperCase()],
        ["BILL STATUS", invoice.dueAmount <= 0 ? "PAID" : "DUE"],
        ["PAYMENT", pMethodStr]
      ];

      mRows.forEach((r, i) => {
        const rowY = metaY + (i * 6);
        doc.setFont(FONT, "bold"); doc.setFontSize(9); safeText(String(r[0]), boxX + 2, rowY);
        doc.setFont(FONT, "normal"); safeText(String(r[1]), boxX + 35, rowY);
        if (i < 4) doc.line(n(boxX), n(rowY + 1), n(boxX + boxW), n(rowY + 1));
      });
      doc.line(n(boxX + 32), n(metaY - 5), n(boxX + 32), n(metaY + 25));

      // Table (with auto height for description)
      const itData = invoice.items.map((item, i) => [i + 1, `${item.brand} ${item.modelName}\nS/N: ${item.imei}`, `1.00`, `PCS`, formatAmount(item.price), formatAmount(item.price)]);
      (doc as any).autoTable({
        startY: metaY + 30, margin: { left: MARGIN, right: MARGIN },
        head: [['SL', 'DESCRIPTION', 'QTY', 'UOM', 'UNIT PRICE', 'AMOUNT']],
        body: itData, theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: 0, lineWidth: 0.1, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, font: FONT, lineWidth: 0.1, cellPadding: 3, textColor: 0, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 15, halign: 'center' }, 4: { cellWidth: 32, halign: 'right' }, 5: { cellWidth: 32, halign: 'right' } }
      });

      let fY = n((doc as any).lastAutoTable?.finalY) || (metaY + 80);
      if (fY + 80 > PAGE_HEIGHT - 40) { doc.addPage(); fY = 20; }
      
      // Summary Box & Calculations
      doc.rect(n(MARGIN), n(fY + 5), 45, 8); doc.setFont(FONT, "bold"); doc.setFontSize(11); safeText(`TOTAL QTY : ${invoice.items.length}.00`, MARGIN + 4, fY + 10.5);
      
      const sX = PAGE_WIDTH - MARGIN - 70; const vX = PAGE_WIDTH - MARGIN;
      const calcRows = [["Total Amount", invoice.subtotal], ["Less Discount", invoice.discount], ["Net Payable", invoice.total], ["Received Amount", invoice.paidAmount], ["Current Due", invoice.dueAmount]];
      calcRows.forEach((r, i) => {
        const rowY = fY + 10 + (i * 7);
        if (i === 2) { doc.setFont(FONT, "bold"); doc.setFontSize(13); } else { doc.setFont(FONT, "normal"); doc.setFontSize(10); }
        safeText(String(r[0]), sX, rowY); safeText(formatAmount(r[1] as number), vX, rowY, { align: 'right' });
      });

      // Wrapped "In Word" text
      doc.setFont(FONT, "bold"); doc.setFontSize(8); safeText("TAKA IN WORD", MARGIN, fY + 20);
      doc.setFont(FONT, "normal"); doc.setFontSize(10);
      const splitWords = doc.splitTextToSize(numberToWords(invoice.total), sX - MARGIN - 5);
      doc.text(splitWords, MARGIN, fY + 26);
      
      // Signatures
      const sigY = PAGE_HEIGHT - 35; doc.line(n(MARGIN), n(sigY), n(MARGIN + 50), n(sigY)); doc.line(n(PAGE_WIDTH - MARGIN - 50), n(sigY), n(PAGE_WIDTH - MARGIN), n(sigY));
      doc.setFontSize(10); doc.setFont(FONT, "bold"); safeText("CUSTOMER SIGNATURE", MARGIN + 25, sigY + 5, { align: 'center' }); safeText("AUTHORIZED SIGNATURE", PAGE_WIDTH - MARGIN - 25, sigY + 5, { align: 'center' });
      
      // Footer Name & Color
      doc.setFont(FONT, "bolditalic"); doc.setFontSize(11);
      doc.setTextColor(180, 180, 180); // Halka color
      safeText(`Thank you for your purchase, ${invoice.customerName}!`, PAGE_WIDTH / 2, PAGE_HEIGHT - 12, { align: 'center' });

      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { console.error(e); }
  };

  const handleShareWhatsApp = () => {
    if (!selectedInvoice) return;
    const msg = `Invoice ${selectedInvoice.invoiceNumber} total ${formatAmount(selectedInvoice.total)} from ${data.shop.name}.`;
    window.open(`https://wa.me/${selectedInvoice.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteInvoice(deleteConfirmId);
      setDeleteConfirmId(null);
      if (selectedInvoice?.id === deleteConfirmId) {
        setSelectedInvoice(null);
      }
    }
  };

  if (selectedInvoice) {
    const firstPayment = selectedInvoice.payments?.[0];
    const groups: Record<string, { brand: string, modelName: string, price: number, imeis: string[] }> = {};
    (selectedInvoice.items || []).forEach(item => {
      const key = `${item.brand}-${item.modelName}-${item.price}`;
      if (!groups[key]) {
        groups[key] = { brand: item.brand, modelName: item.modelName, price: item.price, imeis: [item.imei] };
      } else {
        groups[key].imeis.push(item.imei);
      }
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center no-print bg-white p-4 rounded-xl border shadow-sm">
          <button onClick={() => setSelectedInvoice(null)} className="text-slate-500 hover:text-slate-900 font-bold flex items-center transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg> Back to List
          </button>
          <div className="flex space-x-2">
            <button onClick={() => onEditInvoice(selectedInvoice)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">Edit</button>
            <button onClick={() => generatePDF(selectedInvoice)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">Print PDF</button>
            <button onClick={handleShareWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">WhatsApp</button>
            <button onClick={() => setDeleteConfirmId(selectedInvoice.id)} className="bg-rose-50 text-rose-600 px-5 py-2 rounded-lg font-bold text-sm transition-all">Delete</button>
          </div>
        </div>

        <div className="bg-white p-6 md:p-12 max-w-4xl mx-auto border shadow-2xl font-sans text-slate-900 overflow-x-auto relative rounded-3xl">
          <div className="min-w-[700px]">
            <div className="text-center mb-10">
              <h1 className="text-5xl font-black uppercase mb-1 tracking-tighter text-slate-900">{data.shop.name}</h1>
              <p className="text-sm font-semibold text-slate-500">{data.shop.address}</p>
              <p className="text-sm font-bold mt-1">Mobile : {data.shop.phone}</p>
              <div className="mt-6 border-4 border-slate-900 inline-block px-14 py-1"><h2 className="text-2xl font-black uppercase tracking-widest">Sales Invoice</h2></div>
            </div>

            <div className="grid grid-cols-2 gap-16 mb-10">
              <div className="space-y-3 text-sm">
                <div className="flex"><span className="font-bold w-24">Customer</span><span className="font-black text-lg">: {selectedInvoice.customerName}</span></div>
                <div className="flex"><span className="font-bold w-24">Address</span><span>: {selectedInvoice.customerAddress || 'N/A'}</span></div>
                <div className="flex"><span className="font-bold w-24">Mobile</span><span className="font-bold">: {selectedInvoice.customerPhone}</span></div>
                <div className="flex"><span className="font-bold w-24">Attention</span><span>: {selectedInvoice.attention || ''}</span></div>
              </div>
              <div className="border-4 border-slate-900 text-sm font-bold rounded-xl overflow-hidden">
                {[["INVOICE NO.", selectedInvoice.invoiceNumber], ["DATE", new Date(selectedInvoice.date).toLocaleDateString('en-GB')], ["PREPARED BY", (data.shop.preparedBy || "SOHAG").toUpperCase()], ["BILL STATUS", selectedInvoice.dueAmount <= 0 ? "PAID" : "DUE"], ["PAYMENT", `${firstPayment?.method}`.toUpperCase()]].map((r, i) => (
                  <div key={i} className={`grid grid-cols-5 ${i < 4 ? 'border-b-2 border-slate-200' : ''}`}><div className="col-span-2 p-3 font-black bg-slate-50 border-r-2 border-slate-200 uppercase text-xs">{r[0]}</div><div className="col-span-3 p-3 font-black uppercase text-xs">{r[1]}</div></div>
                ))}
              </div>
            </div>

            <table className="w-full border-collapse border-4 border-slate-900 mb-10 text-xs font-bold">
              <thead className="bg-slate-50 font-black uppercase border-b-4 border-slate-900">
                <tr><td className="p-3 border-r-4 border-slate-900 text-center">SL</td><td className="p-3 border-r-4 border-slate-900">Description</td><td className="p-3 border-r-4 border-slate-900 text-center">Qty</td><td className="p-3 border-r-4 border-slate-900 text-center">UOM</td><td className="p-3 border-r-4 border-slate-900 text-right">Unit Price</td><td className="p-3 text-right">Amount</td></tr>
              </thead>
              <tbody>
                {Object.values(groups).map((g, i) => (
                  <tr key={i} className="border-b-2 border-slate-900">
                    <td className="p-4 border-r-4 border-slate-900 text-center">{i+1}</td>
                    <td className="p-4 border-r-4 border-slate-900"><p className="uppercase font-black text-sm">{g.brand} {g.modelName}</p><div className="text-[11px] text-slate-500 font-mono mt-1">{g.imeis.map(imei => <p key={imei}>S/N: {imei}</p>)}</div></td>
                    <td className="p-4 border-r-4 border-slate-900 text-center">{g.imeis.length}.00</td>
                    <td className="p-4 border-r-4 border-slate-900 text-center">PCS</td>
                    <td className="p-4 border-r-4 border-slate-900 text-right">{formatAmount(g.price)}</td>
                    <td className="p-4 text-right">{formatAmount(g.price * g.imeis.length)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-start">
              <div className="space-y-10">
                <div className="border-4 border-slate-900 px-6 py-3 font-black text-lg inline-block min-w-[200px] text-center uppercase tracking-tighter">TOTAL QTY : {selectedInvoice.items.length}.00</div>
                <div className="space-y-1"><p className="text-[10px] font-black uppercase text-slate-400">Taka In Word</p><p className="text-lg font-bold italic">{numberToWords(selectedInvoice.total)}</p></div>
              </div>
              <div className="w-80 space-y-2 text-sm border-t-8 border-slate-900 pt-6">
                <div className="flex justify-between font-bold text-slate-600"><span>Total Amount</span><span>{formatAmount(selectedInvoice.subtotal)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Less Discount</span><span>{formatAmount(selectedInvoice.discount)}</span></div>
                <div className="flex justify-between py-3 border-y border-slate-100 font-black text-3xl text-slate-900"><span>Net Payable</span><span>{formatAmount(selectedInvoice.total)}</span></div>
                <div className="flex justify-between text-emerald-600 font-black text-lg"><span>Received Amount</span><span>{formatAmount(selectedInvoice.paidAmount)}</span></div>
                <div className="flex justify-between text-rose-600 font-black text-xl pt-2 border-t-4 border-double border-slate-900"><span>Current Due</span><span>{formatAmount(selectedInvoice.dueAmount)}</span></div>
              </div>
            </div>
            <div className="mt-32 border-t-2 border-slate-900 pt-2 text-center text-sm font-bold italic text-slate-400">Thank you for your purchase, {selectedInvoice.customerName}!</div>
          </div>
        </div>

        {deleteConfirmId && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border-4 border-rose-500 animate-in zoom-in duration-200">
              <h3 className="text-2xl font-black text-slate-900 uppercase mb-4 text-center">Delete Invoice?</h3>
              <p className="text-slate-500 text-sm text-center mb-8 font-medium">This will remove the invoice record and return the items to available stock. This cannot be undone.</p>
              <div className="flex flex-col gap-3">
                <button onClick={confirmDelete} className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-500/20">Delete Invoice</button>
                <button onClick={() => setDeleteConfirmId(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Invoice History</h2>
      </div>
      
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 border-b">
          <div className="md:col-span-2 p-4 bg-slate-50 flex items-center space-x-2 border-r">
             <Icons.Search />
             <input type="text" placeholder="Search by Invoice, Customer or Phone..." className="bg-transparent outline-none font-bold text-xs flex-1" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="p-4 bg-slate-50 flex items-center space-x-2 border-r">
            <span className="text-[10px] font-black text-slate-400 uppercase">Filter:</span>
            <select className="bg-transparent outline-none font-black text-[10px] uppercase text-blue-600" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="ALL">All Status</option>
              <option value="PAID">Paid Only</option>
              <option value="DUE">Due Only</option>
            </select>
          </div>
          <div className="p-4 bg-slate-50 flex items-center justify-center">
            <span className="text-[10px] font-black text-slate-400 uppercase">{filteredInvoices.length} Found</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b"><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="px-8 py-5">Invoice #</th><th className="px-8 py-5">Date</th><th className="px-8 py-5">Customer Info</th><th className="px-8 py-5 text-right">Net Amount</th><th className="px-8 py-5 text-center">Status</th><th className="px-8 py-5 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-medium italic">No invoices found.</td></tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-blue-50/30 cursor-pointer group" onClick={() => setSelectedInvoice(inv)}>
                    <td className="px-8 py-6 font-mono font-black text-blue-600 text-sm group-hover:underline">{inv.invoiceNumber}</td>
                    <td className="px-8 py-6 text-slate-500 text-xs font-bold">{new Date(inv.date).toLocaleDateString('en-GB')}</td>
                    <td className="px-8 py-6">
                      <p className="font-black uppercase text-xs text-slate-900">{inv.customerName}</p>
                      <p className="text-[10px] font-bold text-slate-400">{inv.customerPhone}</p>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-900">{inv.total.toLocaleString()}</td>
                    <td className="px-8 py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${inv.dueAmount <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{inv.dueAmount <= 0 ? 'PAID' : 'DUE'}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end items-center space-x-1">
                        <button onClick={(e) => { e.stopPropagation(); generatePDF(inv); }} className="p-2 text-slate-300 hover:text-slate-900 transition-colors" title="Print PDF"><Icons.Print /></button>
                        <button onClick={(e) => { e.stopPropagation(); onEditInvoice(inv); }} className="p-2 text-slate-300 hover:text-blue-600 transition-colors" title="Edit Invoice"><Icons.Settings /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(inv.id); }} className="p-2 text-slate-300 hover:text-rose-600 transition-colors" title="Delete Invoice"><Icons.Trash /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border-4 border-rose-500 animate-in zoom-in duration-200">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icons.Trash />
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase mb-4 text-center">Delete Invoice?</h3>
            <p className="text-slate-500 text-sm text-center mb-8 font-medium">Are you sure? This will remove the invoice record and return the items to available stock.</p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-500/20">Delete Permanent</button>
              <button onClick={() => setDeleteConfirmId(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceHistory;
