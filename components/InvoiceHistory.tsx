
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Invoice, PaymentMethod } from '../types';
import { Icons } from '../constants';

const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convert = (n: number): string => {
    const val = Math.floor(n);
    if (val <= 0) return '';
    if (val < 20) return a[val];
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '');
    if (val < 1000) return convert(Math.floor(val / 100)) + ' Hundred ' + (val % 100 !== 0 ? 'and ' + convert(val % 100) : '');
    if (val < 100000) return convert(Math.floor(val / 1000)) + ' Thousand ' + (val % 1000 !== 0 ? convert(val % 1000) : '');
    if (val < 10000000) return convert(Math.floor(val / 100000)) + ' Lakh ' + (val % 100000 !== 0 ? convert(val % 100000) : '');
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

type DatePeriod = 'all' | 'today' | '7days' | 'month' | 'custom';

const InvoiceHistory: React.FC<Props> = ({ data, initialInvoiceId, onClearInitial, onEditInvoice, onDeleteInvoice }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Date Filtering States
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (initialInvoiceId) {
      const inv = data.invoices.find(i => i.id === initialInvoiceId);
      if (inv) setSelectedInvoice(inv);
      onClearInitial?.();
    }
  }, [initialInvoiceId, data.invoices, onClearInitial]);

  const filteredInvoices = useMemo(() => {
    return data.invoices.filter(inv => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = (inv.customerName || "").toLowerCase().includes(q) || 
                            (inv.invoiceNumber || "").toLowerCase().includes(q) || 
                            (inv.customerPhone || "").includes(searchQuery);
      
      if (!matchesSearch) return false;

      const invDate = new Date(inv.date);
      const now = new Date();
      
      if (datePeriod === 'today') {
        return invDate.toDateString() === now.toDateString();
      } else if (datePeriod === '7days') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return invDate >= weekAgo;
      } else if (datePeriod === 'month') {
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      } else if (datePeriod === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return invDate >= start && invDate <= end;
      }

      return true;
    }).slice().reverse();
  }, [data.invoices, searchQuery, datePeriod, startDate, endDate]);

  const periodSummary = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => ({
      sales: acc.sales + inv.subtotal,
      discount: acc.discount + inv.discount,
      net: acc.net + inv.total,
      received: acc.received + inv.paidAmount,
      due: acc.due + inv.dueAmount,
      count: acc.count + 1
    }), { sales: 0, discount: 0, net: 0, received: 0, due: 0, count: 0 });
  }, [filteredInvoices]);

  const generatePDF = (invoice: Invoice) => {
    try {
      const { jsPDF } = (window as any).jspdf;
      if (!jsPDF) return;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const PAGE_WIDTH = doc.internal.pageSize.getWidth();
      const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
      const MARGIN = 10; 
      const FONT = "helvetica";
      const safeText = (text: any, x: number, y: number, o?: any) => doc.text(String(text || ""), x, y, o);

      let currentY = 15;

      // --- LOGO HANDLING (TOP LEFT, 60% OPACITY) ---
      if (data.shop.logoUrl && data.shop.logoUrl.startsWith('data:image')) {
        try {
          const logoSize = 35; 
          const mimeMatch = data.shop.logoUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : '';
          const formatMatch = mimeType.match(/\/([a-zA-Z+]+)$/);
          let format = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
          if (format === 'JPG') format = 'JPEG';
          const isSupported = ['PNG', 'JPEG', 'WEBP'].includes(format);
          if (isSupported) {
            // 60% Visual Opacity
            const gState = new (doc as any).GState({ opacity: 0.6 });
            doc.saveGraphicsState();
            doc.setGState(gState);
            doc.addImage(data.shop.logoUrl, format, MARGIN, 5, logoSize, logoSize);
            doc.restoreGraphicsState();
          }
        } catch (e) { console.error("Logo Render Error:", e); }
      }

      doc.setTextColor(0); 
      doc.setFont(FONT, "bold").setFontSize(22);
      safeText(data.shop.name.toUpperCase(), PAGE_WIDTH / 2, currentY, { align: 'center' });
      currentY += 8;
      doc.setFontSize(9).setFont(FONT, "normal");
      safeText(data.shop.address, PAGE_WIDTH / 2, currentY, { align: 'center' });
      currentY += 5;
      doc.setFont(FONT, "bold"); 
      // Include email next to phone number
      safeText(`Mobile: ${data.shop.phone}${data.shop.email ? ` | Email: ${data.shop.email}` : ''}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
      currentY += 10;
      doc.setFontSize(13); doc.setFont(FONT, "bold");
      doc.line(PAGE_WIDTH / 2 - 25, currentY + 1, PAGE_WIDTH / 2 + 25, currentY + 1);
      safeText("Sales Invoice", PAGE_WIDTH / 2, currentY, { align: 'center' });
      currentY += 12;

      const infoW = 60, infoX = PAGE_WIDTH - MARGIN - infoW;
      let metaY = currentY - 5;
      const drawInfoRow = (label: string, value: string, y: number) => {
        doc.setFont(FONT, "bold").setFontSize(8);
        doc.rect(infoX, y, infoW/2, 5.5);
        safeText(label, infoX + 2, y + 3.8);
        doc.rect(infoX + infoW/2, y, infoW/2, 5.5);
        doc.setFont(FONT, "normal");
        safeText(value, infoX + infoW/2 + 2, y + 3.8, { maxWidth: infoW/2 - 4 });
      };
      drawInfoRow("Invoice No.", invoice.invoiceNumber, metaY);
      drawInfoRow("Date", new Date(invoice.date).toLocaleDateString('en-GB'), metaY += 5.5);
      drawInfoRow("Prepared By", (data.shop.preparedBy || "ADMIN").toUpperCase(), metaY += 5.5);
      drawInfoRow("Bill Status", invoice.dueAmount <= 0 ? "PAID" : "DUE", metaY += 5.5);
      drawInfoRow("Payment Method", invoice.payments?.[0]?.method || "N/A", metaY += 5.5);

      const valX = MARGIN + 25; const maxValW = infoX - valX - 5;
      const addCustRow = (label: string, value: string) => {
        doc.setFont(FONT, "bold").setFontSize(10);
        safeText(label, MARGIN, currentY);
        doc.setFont(FONT, "normal");
        const lines = doc.splitTextToSize(": " + (value || 'N/A'), maxValW);
        doc.text(lines, valX, currentY);
        currentY += (lines.length * 5) + 1;
      };
      addCustRow("Customer", invoice.customerName);
      addCustRow("Address", invoice.customerAddress || '');
      addCustRow("Mobile", invoice.customerPhone);

      const tableStartY = Math.max(currentY + 5, metaY + 10);
      const itData: any[] = invoice.items.map((it, i) => [
        i + 1, 
        { content: `${it.brand} ${it.modelName}\nS/N: ${it.imei}`, styles: { fontStyle: 'bold' } },
        '1.00', 
        formatAmount(it.price)
      ]);

      itData.push([
        { content: 'TOTAL ITEM QUANTITY:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: invoice.items.length.toFixed(2), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: formatAmount(invoice.subtotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } }
      ]);

      (doc as any).autoTable({
        startY: tableStartY, margin: { left: MARGIN, right: MARGIN },
        head: [['SL', 'DESCRIPTION', 'QTY', 'AMOUNT']],
        body: itData, theme: 'grid', 
        headStyles: { fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8.5, font: FONT, lineWidth: 0.1, cellPadding: 2.5, textColor: 0, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 35, halign: 'right' } }
      });

      let fY = (doc as any).lastAutoTable.finalY + 10;
      const sumW = 75, sumX = PAGE_WIDTH - MARGIN - sumW;
      const drawSumRow = (label: string, val: string, y: number, isBold: boolean = false) => {
        doc.setFont(FONT, isBold ? "bold" : "normal").setFontSize(8.5);
        doc.rect(sumX, y, sumW - 25, 6.5); safeText(label, sumX + 2, y + 4.5);
        doc.rect(sumX + sumW - 25, y, 25, 6.5); safeText(val, sumX + sumW - 2, y + 4.5, { align: 'right' });
      };
      drawSumRow("TOTAL AMOUNT", formatAmount(invoice.subtotal), fY, true);
      drawSumRow("LESS DISCOUNT (-)", formatAmount(invoice.discount), fY += 6.5);
      drawSumRow("NET PAYABLE", formatAmount(invoice.total), fY += 6.5, true);
      drawSumRow("RECEIVED AMOUNT", formatAmount(invoice.paidAmount), fY += 6.5, true);
      drawSumRow("CURRENT DUE", formatAmount(invoice.dueAmount), fY += 6.5, true);

      doc.setFont(FONT, "bold").setFontSize(9); safeText(`Taka In Word :`, MARGIN, (doc as any).lastAutoTable.finalY + 15);
      doc.setFont(FONT, "italic");
      const wordLines = doc.splitTextToSize(numberToWords(invoice.total), sumX - MARGIN - 10);
      doc.text(wordLines, MARGIN, (doc as any).lastAutoTable.finalY + 20);

      const sigY = PAGE_HEIGHT - 35;
      doc.line(MARGIN, sigY, MARGIN + 45, sigY); doc.line(PAGE_WIDTH - MARGIN - 45, sigY, PAGE_WIDTH - MARGIN, sigY);
      doc.setFontSize(9).setFont(FONT, "bold"); safeText("Customer Signature", MARGIN + 5, sigY + 5); safeText("Authorised Signature", PAGE_WIDTH - MARGIN - 40, sigY + 5);

      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { console.error(e); }
  };

  if (selectedInvoice) {
    const mainPymt = selectedInvoice.payments?.[0];
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-10">
        <style dangerouslySetInnerHTML={{ __html: `@media print { #invoice-print-area { display: flex !important; flex-direction: column !important; height: 100% !important; } .page-break-avoid { page-break-inside: avoid !important; } }`}} />
        <div className="flex justify-between items-center no-print bg-white p-4 rounded-xl border shadow-sm sticky top-0 z-[40]">
          <button onClick={() => setSelectedInvoice(null)} className="text-slate-500 hover:text-slate-900 font-bold flex items-center transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg> Back to List
          </button>
          <div className="flex space-x-2">
            <button onClick={() => onEditInvoice(selectedInvoice)} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">Edit</button>
            <button onClick={() => generatePDF(selectedInvoice)} className="bg-slate-900 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">Print (PDF)</button>
            <button onClick={() => window.print()} className="bg-slate-100 text-slate-900 px-5 py-2 rounded-lg font-bold text-sm transition-all">Print (A4)</button>
            <button onClick={() => setDeleteConfirmId(selectedInvoice.id)} className="bg-rose-50 text-rose-600 px-5 py-2 rounded-lg font-bold text-sm transition-all">Delete</button>
          </div>
        </div>
        <div id="invoice-print-area" className="bg-white max-w-[794px] w-full mx-auto p-10 border shadow-2xl rounded-sm text-slate-900 min-h-[1123px] flex flex-col box-border font-sans print:p-8 print:shadow-none print:border-none print:m-0">
          <div className="flex flex-col items-center mb-8 border-b-2 border-slate-900 pb-6 page-break-avoid">
            {data.shop.logoUrl && (<div className="w-48 mb-4"><img src={data.shop.logoUrl} className="w-full h-auto object-contain" alt="Logo" /></div>)}
            <div className="text-center">
              <h1 className="text-4xl font-black uppercase mb-1 tracking-tighter">{data.shop.name}</h1>
              <p className="text-[12px] font-semibold text-slate-600 leading-tight">{data.shop.address}</p>
              <p className="text-[12px] font-bold mt-1">Mobile: {data.shop.phone}{data.shop.email ? ` | Email: ${data.shop.email}` : ''}</p>
            </div>
          </div>
          <div className="text-center mb-10 page-break-avoid"><span className="border-4 border-slate-900 px-10 py-1.5 text-2xl font-black uppercase tracking-[0.2em]">Sales Invoice</span></div>
          <div className="grid grid-cols-2 gap-12 mb-10 items-start page-break-avoid">
            <div className="space-y-2 text-[14px]">
              <div className="flex border-b border-slate-100 pb-1"><span className="font-bold w-24 flex-shrink-0">Customer</span><span className="font-black flex-1">: {selectedInvoice.customerName}</span></div>
              <div className="flex border-b border-slate-100 pb-1"><span className="font-bold w-24 flex-shrink-0">Mobile</span><span className="font-bold flex-1">: {selectedInvoice.customerPhone}</span></div>
            </div>
            <div className="border-2 border-slate-900 rounded-sm overflow-hidden text-[12px]">
               <div className="flex border-b-2 border-slate-900"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900">INVOICE NO.</div><div className="w-1/2 p-2 font-bold uppercase">{selectedInvoice.invoiceNumber}</div></div>
               <div className="flex border-b-2 border-slate-900"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900">DATE</div><div className="w-1/2 p-2 font-bold">{new Date(selectedInvoice.date).toLocaleDateString('en-GB')}</div></div>
               <div className="flex border-b-2 border-slate-900"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900">BILL STATUS</div><div className="w-1/2 p-2 font-black text-blue-700">{selectedInvoice.dueAmount > 0 ? 'DUE' : 'PAID'}</div></div>
            </div>
          </div>
          <table className="w-full border-collapse border-2 border-slate-900 mb-6 table-fixed">
            <thead className="bg-slate-50"><tr className="text-[12px] font-black uppercase text-center"><th className="border-2 border-slate-900 p-2 w-[8%]">SL</th><th className="border-2 border-slate-900 p-2 w-[62%] text-left">DESCRIPTION</th><th className="border-2 border-slate-900 p-2 w-[10%]">QTY</th><th className="border-2 border-slate-900 p-2 w-[20%] text-right">AMOUNT</th></tr></thead>
            <tbody className="text-[12px] font-medium uppercase">
              {selectedInvoice.items.map((it, i) => (<tr key={i}><td className="border-2 border-slate-900 p-2 text-center">{i+1}</td><td className="border-2 border-slate-900 p-2 whitespace-pre-wrap leading-tight"><span className="font-black text-slate-900 text-[13px]">{it.brand} {it.modelName}</span><br/><span className="text-[10px] text-slate-400">S/N: {it.imei}</span></td><td className="border-2 border-slate-900 p-2 text-center font-bold">1.00</td><td className="border-2 border-slate-900 p-2 text-right font-black">{it.price.toLocaleString()}</td></tr>))}
              <tr className="bg-slate-50 font-black text-[13px]"><td colSpan={2} className="border-2 border-slate-900 p-3 text-right uppercase">TOTAL ITEM QUANTITY:</td><td className="border-2 border-slate-900 p-3 text-center">{selectedInvoice.items.length.toFixed(2)}</td><td className="border-2 border-slate-900 p-3 text-right">{selectedInvoice.subtotal.toLocaleString()}</td></tr>
            </tbody>
          </table>
          <div className="mt-auto pt-20 flex justify-between px-8 page-break-avoid"><div className="w-48 text-center border-t-2 border-slate-900 pt-2 font-black uppercase text-[11px]">Customer Signature</div><div className="w-48 text-center border-t-2 border-slate-900 pt-2 font-black uppercase text-[11px]">Authorized Signature</div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Search and Period Selector */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/20 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1 flex items-center bg-white px-5 py-3 rounded-2xl border shadow-sm max-w-md transition-all focus-within:ring-2 ring-slate-100">
              <div className="text-slate-300 mr-4"><Icons.Search /></div>
              <input 
                type="text" 
                placeholder="SEARCH CUSTOMER, PHONE OR INVOICE..." 
                className="flex-1 bg-transparent outline-none font-black text-[10px] tracking-widest text-slate-900 uppercase placeholder:text-slate-300" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'custom', label: 'Custom Range' }
              ].map(btn => (
                <button 
                  key={btn.id}
                  onClick={() => setDatePeriod(btn.id as DatePeriod)}
                  className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${datePeriod === btn.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white border text-slate-400 hover:border-slate-300'}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {datePeriod === 'custom' && (
            <div className="flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-xl max-w-2xl">
              <div className="flex flex-col space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Start Date</label>
                <input 
                  type="date" 
                  className="bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-xl px-4 py-2.5 text-xs font-bold outline-none transition-all" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                />
              </div>
              <div className="w-4 h-0.5 bg-slate-100 mt-4 rounded-full"></div>
              <div className="flex flex-col space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">End Date</label>
                <input 
                  type="date" 
                  className="bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-xl px-4 py-2.5 text-xs font-bold outline-none transition-all" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                />
              </div>
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }} 
                className="mt-4 px-4 py-2 text-rose-500 font-black text-[9px] uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Period Summary Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-8 bg-white border-b border-slate-50">
           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 group hover:border-slate-900 transition-all">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Sales</p>
             <p className="text-xl font-black text-slate-900">{periodSummary.sales.toLocaleString()}</p>
             <p className="text-[8px] font-black text-slate-300 uppercase mt-2">{periodSummary.count} Invoices</p>
           </div>
           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 group hover:border-slate-900 transition-all">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Discounts</p>
             <p className="text-xl font-black text-rose-500">{periodSummary.discount.toLocaleString()}</p>
             <p className="text-[8px] font-black text-slate-300 uppercase mt-2">Applied reduction</p>
           </div>
           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 group hover:border-slate-900 transition-all">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Revenue</p>
             <p className="text-xl font-black text-blue-600">{periodSummary.net.toLocaleString()}</p>
             <p className="text-[8px] font-black text-slate-300 uppercase mt-2">Target collection</p>
           </div>
           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 group hover:border-slate-900 transition-all">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Paid Amount</p>
             <p className="text-xl font-black text-emerald-600">{periodSummary.received.toLocaleString()}</p>
             <p className="text-[8px] font-black text-slate-300 uppercase mt-2">Cash in hand</p>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Invoice No</th>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Date</th>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Customer</th>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Total</th>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Status</th>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No matching records found for this period</td></tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-all group cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                    <td className="px-8 py-5 font-black text-blue-600 text-xs uppercase">{inv.invoiceNumber}</td>
                    <td className="px-8 py-5 text-slate-500 font-bold text-[10px]">{new Date(inv.date).toLocaleDateString('en-GB')}</td>
                    <td className="px-8 py-5"><p className="font-bold text-slate-900 text-xs uppercase">{inv.customerName}</p><p className="text-[9px] text-slate-400 font-bold">{inv.customerPhone}</p></td>
                    <td className="px-8 py-5 text-right font-black text-slate-900 text-xs">{inv.total.toLocaleString()}</td>
                    <td className="px-8 py-5 text-center"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${inv.dueAmount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{inv.dueAmount > 0 ? `DUE` : 'PAID'}</span></td>
                    <td className="px-8 py-5 text-center"><div className="flex justify-center space-x-3 text-slate-300"><button onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }} className="hover:text-slate-900 transition-colors"><Icons.Print /></button><button onClick={(e) => { e.stopPropagation(); onEditInvoice(inv); }} className="hover:text-blue-600 transition-colors"><Icons.Settings /></button></div></td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredInvoices.length > 0 && (
              <tfoot className="bg-slate-50/30 border-t border-slate-100">
                <tr className="font-black text-slate-900">
                  <td colSpan={3} className="px-8 py-6 text-right text-[10px] uppercase tracking-widest text-slate-400">Grand Total for Period:</td>
                  <td className="px-8 py-6 text-right text-sm">{periodSummary.net.toLocaleString()}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] max-md w-full p-10 shadow-2xl border border-slate-100 animate-in zoom-in duration-200 text-center">
            <h3 className="text-2xl font-black text-slate-900 uppercase mb-4 tracking-tighter">Delete Invoice?</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-10 leading-relaxed">This action will return items to stock and purge this record from cloud storage.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { onDeleteInvoice(deleteConfirmId); setDeleteConfirmId(null); setSelectedInvoice(null); }} className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-rose-100">Confirm Deletion</button>
              <button onClick={() => setDeleteConfirmId(null)} className="w-full bg-slate-50 text-slate-400 py-4 rounded-2xl font-black uppercase text-xs">Keep Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceHistory;
