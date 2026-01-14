
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
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (initialInvoiceId) {
      const inv = data.invoices.find(i => i.id === initialInvoiceId || i.invoiceNumber === initialInvoiceId);
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
      if (datePeriod === 'today') return invDate.toDateString() === now.toDateString();
      if (datePeriod === '7days') {
        const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
        return invDate >= weekAgo;
      }
      if (datePeriod === 'month') return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      if (datePeriod === 'custom' && startDate && endDate) {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);
        return invDate >= start && invDate <= end;
      }
      return true;
    }).slice().reverse();
  }, [data.invoices, searchQuery, datePeriod, startDate, endDate]);

  const generatePDF = (invoice: Invoice) => {
    try {
      const { jsPDF } = (window as any).jspdf;
      if (!jsPDF) return;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const PAGE_WIDTH = doc.internal.pageSize.getWidth();
      const MARGIN = 10; 
      const FONT = "helvetica";
      const logoSize = 15;
      const safeText = (text: any, x: number, y: number, o?: any) => doc.text(String(text || ""), x, y, o);

      let currentY = 15;

      if (data.shop.logoUrl) {
        try {
          const format = data.shop.logoUrl.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
          doc.addImage(data.shop.logoUrl, format, MARGIN, 8, logoSize, logoSize);
        } catch (e) { console.error("Logo Error:", e); }
      }

      doc.setTextColor(0); 
      doc.setFont(FONT, "bold").setFontSize(22);
      safeText(data.shop.name.toUpperCase(), PAGE_WIDTH / 2, currentY, { align: 'center' });
      currentY += 6;
      doc.setFontSize(10).setFont(FONT, "normal");
      safeText(data.shop.address, PAGE_WIDTH / 2, currentY, { align: 'center' });
      currentY += 5;
      safeText(`Mobile : ${data.shop.phone}${data.shop.email ? `, E-mail : ${data.shop.email}` : ''}`, PAGE_WIDTH / 2, currentY, { align: 'center' });
      currentY += 10;

      doc.setFontSize(14).setFont(FONT, "bold");
      safeText("Sales Invoice", PAGE_WIDTH / 2, currentY, { align: 'center' });
      doc.line(PAGE_WIDTH / 2 - 20, currentY + 1, PAGE_WIDTH / 2 + 20, currentY + 1);
      currentY += 10;

      const metaX = PAGE_WIDTH - MARGIN - 70;
      const rowH = 6;
      let metaY = currentY;

      const drawMetaRow = (label: string, val: string, y: number) => {
        doc.setFont(FONT, "bold").setFontSize(8.5);
        doc.rect(metaX, y, 25, rowH);
        safeText(label, metaX + 2, y + 4.2);
        doc.rect(metaX + 25, y, 45, rowH);
        doc.setFont(FONT, "normal");
        safeText(val, metaX + 27, y + 4.2);
      };

      drawMetaRow("Invoice No.", invoice.invoiceNumber, metaY);
      drawMetaRow("Date", new Date(invoice.date).toLocaleDateString('en-GB'), metaY += rowH);
      drawMetaRow("Prepared By", data.shop.preparedBy || "ADMIN", metaY += rowH);
      drawMetaRow("Entry Time", new Date(invoice.date).toLocaleTimeString(), metaY += rowH);
      drawMetaRow("Bill Status", invoice.dueAmount <= 0 ? "PAID" : "DUE", metaY += rowH);
      
      const pmt = invoice.payments?.[0];
      const pmtText = pmt?.method === PaymentMethod.CASH ? pmt.method : `${pmt?.method} (${pmt?.bankName || pmt?.paymentPhone || 'N/A'})`;
      drawMetaRow("Payment", pmtText, metaY += rowH);

      let custY = currentY;
      const drawCustRow = (label: string, val: string, y: number) => {
        doc.setFont(FONT, "bold").setFontSize(9.5);
        safeText(label, MARGIN, y);
        doc.setFont(FONT, "normal");
        safeText(`: ${val}`, MARGIN + 22, y, { maxWidth: metaX - MARGIN - 25 });
      };

      drawCustRow("Customer", invoice.customerName, custY);
      drawCustRow("Address", invoice.customerAddress || "N/A", custY += 6);
      drawCustRow("Mobile", invoice.customerPhone, custY += 6);
      drawCustRow("Narration", invoice.narration || "N/A", custY += 6);
      
      const tableStartY = Math.max(metaY + rowH + 5, custY + 10);
      const itData: any[] = invoice.items.map((it, i) => [
        i + 1, 
        { content: `${it.brand} ${it.modelName}\nS/N: ${it.imei}`, styles: { fontStyle: 'bold' } },
        '1.00',
        formatAmount(it.price),
        formatAmount(it.price)
      ]);

      (doc as any).autoTable({
        startY: tableStartY, margin: { left: MARGIN, right: MARGIN },
        head: [['SL', 'Product Description', 'Qty', 'Unit Price', 'Amount']],
        body: itData, theme: 'grid', 
        headStyles: { fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8.5, font: FONT, lineWidth: 0.1, cellPadding: 2.5, textColor: 0, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 30, halign: 'right' } }
      });

      let fY = (doc as any).lastAutoTable.finalY + 5;
      doc.rect(MARGIN + 40, fY, 40, 6);
      doc.setFont(FONT, "bold").setFontSize(9);
      safeText("Total Qty :", MARGIN + 42, fY + 4.2);
      safeText(invoice.items.length.toFixed(2), MARGIN + 78, fY + 4.2, { align: 'right' });

      const sumX = PAGE_WIDTH - MARGIN - 65;
      const drawSum = (label: string, val: string, y: number, isBold: boolean = false) => {
        doc.setFont(FONT, isBold ? "bold" : "normal").setFontSize(9);
        safeText(label, sumX, y);
        safeText(val, PAGE_WIDTH - MARGIN, y, { align: 'right' });
      };

      let sY = fY;
      drawSum("Total Amount", formatAmount(invoice.subtotal), sY, true);
      drawSum("Less Discount", formatAmount(invoice.discount), sY += 5);
      doc.line(sumX, sY + 1, PAGE_WIDTH - MARGIN, sY + 1);
      drawSum("Net Payable Amount", formatAmount(invoice.total), sY += 6, true);
      
      doc.line(sumX, sY + 1, PAGE_WIDTH - MARGIN, sY + 1);
      drawSum("Received Amount", formatAmount(invoice.paidAmount), sY += 6, true);
      doc.line(sumX, sY + 1, PAGE_WIDTH - MARGIN, sY + 1);
      drawSum("Current Due", formatAmount(invoice.dueAmount), sY += 6, true);

      let bottomL = fY + 10;
      doc.setFont(FONT, "bold").setFontSize(9);
      safeText(`Taka In Word : ${numberToWords(invoice.total)}`, MARGIN, bottomL);

      const sigY = doc.internal.pageSize.getHeight() - 25;
      doc.line(MARGIN, sigY, MARGIN + 40, sigY);
      doc.line(PAGE_WIDTH - MARGIN - 40, sigY, PAGE_WIDTH - MARGIN, sigY);
      doc.setFontSize(9).setFont(FONT, "bold");
      safeText("Customer Signature", MARGIN + 5, sigY + 5);
      safeText("Authorised Signature", PAGE_WIDTH - MARGIN - 38, sigY + 5);

      const footerY = doc.internal.pageSize.getHeight() - 10;
      doc.setFontSize(7).setFont(FONT, "normal");
      doc.line(MARGIN, footerY - 2, PAGE_WIDTH - MARGIN, footerY - 2);
      safeText(`Last Added by : ${data.shop.preparedBy || 'admin'}`, MARGIN, footerY);
      safeText(`Print Date & Time : ${new Date().toLocaleString()}`, MARGIN + 100, footerY);
      safeText(`Page 1 of 1`, PAGE_WIDTH - MARGIN - 15, footerY);

      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { console.error("PDF History Error:", e); }
  };

  if (selectedInvoice) {
    const pmt = selectedInvoice.payments?.[0];
    const pmtText = pmt?.method === PaymentMethod.CASH ? pmt.method : `${pmt?.method} (${pmt?.bankName || pmt?.paymentPhone || 'N/A'})`;

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
            <button onClick={() => onDeleteInvoice(selectedInvoice.id)} className="bg-rose-50 text-rose-600 px-5 py-2 rounded-lg font-bold text-sm transition-all">Delete</button>
          </div>
        </div>
        
        <div id="invoice-print-area" className="bg-white max-w-[794px] w-full mx-auto p-10 border shadow-2xl rounded-sm text-slate-900 min-h-[1123px] flex flex-col box-border font-sans print:p-8 print:shadow-none print:border-none print:m-0 relative overflow-hidden text-left">
          <div className="absolute top-8 left-8 w-16">{data.shop.logoUrl && <img src={data.shop.logoUrl} className="w-full h-auto" alt="Logo" />}</div>
          <div className="text-center mb-6">
            <h1 className="text-4xl font-black uppercase mb-1 tracking-tight">{data.shop.name}</h1>
            <p className="text-[12px] font-semibold text-slate-500">{data.shop.address}</p>
            <p className="text-[12px] font-bold mt-1">Mobile: {data.shop.phone}{data.shop.email ? `, E-mail : ${data.shop.email}` : ''}</p>
          </div>
          <div className="text-center mb-8"><span className="text-xl font-black uppercase tracking-widest border-b-2 border-slate-900 pb-1">Sales Invoice</span></div>
          <div className="grid grid-cols-2 gap-8 mb-8 items-start">
            <div className="space-y-1.5 text-[12px]">
              <div className="flex"><span className="font-bold w-22 min-w-[80px]">Customer</span><span className="font-black flex-1">: {selectedInvoice.customerName}</span></div>
              <div className="flex"><span className="font-bold w-22 min-w-[80px]">Address</span><span className="font-bold flex-1">: {selectedInvoice.customerAddress || 'N/A'}</span></div>
              <div className="flex"><span className="font-bold w-22 min-w-[80px]">Mobile</span><span className="font-bold flex-1">: {selectedInvoice.customerPhone}</span></div>
              <div className="flex"><span className="font-bold w-22 min-w-[80px]">Narration</span><span className="font-bold flex-1">: {selectedInvoice.narration || 'N/A'}</span></div>
            </div>
            <div className="border border-slate-400 rounded-sm overflow-hidden text-[11px]">
               {[
                 { l: 'Invoice No.', v: selectedInvoice.invoiceNumber },
                 { l: 'Date', v: new Date(selectedInvoice.date).toLocaleDateString('en-GB') },
                 { l: 'Prepared By', v: data.shop.preparedBy || 'ADMIN' },
                 { l: 'Entry Time', v: new Date(selectedInvoice.date).toLocaleTimeString() },
                 { l: 'Bill Status', v: selectedInvoice.dueAmount <= 0 ? 'PAID' : 'DUE' },
                 { l: 'Payment', v: pmtText }
               ].map((row, idx) => (
                 <div key={idx} className="flex border-b last:border-0 border-slate-400 text-left">
                   <div className="w-[40%] p-1.5 bg-slate-50 font-bold border-r border-slate-400">{row.l}</div>
                   <div className={`w-[60%] p-1.5 font-bold ${row.l === 'Bill Status' ? 'text-blue-700 font-black' : ''}`}>{row.v}</div>
                 </div>
               ))}
            </div>
          </div>
          <table className="w-full border-collapse border border-slate-400 mb-6 text-[12px]">
            <thead className="bg-slate-50"><tr className="font-black uppercase text-center"><th className="border border-slate-400 p-2 w-[5%]">SL</th><th className="border border-slate-400 p-2 text-left">Product Description</th><th className="border border-slate-400 p-2 w-[10%]">Qty</th><th className="border border-slate-400 p-2 w-[15%] text-right">Unit Price</th><th className="border border-slate-400 p-2 w-[15%] text-right">Amount</th></tr></thead>
            <tbody>
              {selectedInvoice.items.map((it, i) => (<tr key={i}><td className="border border-slate-400 p-2 text-center">{i+1}</td><td className="border border-slate-400 p-2 font-bold whitespace-pre-wrap leading-tight">{it.brand} {it.modelName}<br/><span className="text-[10px] text-slate-500">S/N: {it.imei}</span></td><td className="border border-slate-400 p-2 text-center font-bold">1.00</td><td className="border border-slate-400 p-2 text-right font-black">{it.price.toLocaleString()}</td><td className="border border-slate-400 p-2 text-right font-black">{it.price.toLocaleString()}</td></tr>))}
            </tbody>
          </table>
          <div className="flex justify-between items-start mb-10">
             <div className="flex-1 space-y-4">
                <div className="border border-slate-900 w-fit px-6 py-1.5 font-black text-sm">Total Qty : <span className="ml-4">{selectedInvoice.items.length.toFixed(2)}</span></div>
                <div className="text-[12px] font-bold">Taka In Word : <span className="font-medium italic">{numberToWords(selectedInvoice.total)}</span></div>
             </div>
             <div className="w-72 space-y-1 text-[13px] text-right">
                <div className="flex justify-between py-1"><span className="font-bold">Total Amount</span><span className="font-black">{selectedInvoice.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between py-1"><span className="font-bold">Less Discount</span><span className="font-black">{selectedInvoice.discount.toLocaleString()}</span></div>
                <div className="flex justify-between py-1 border-t border-slate-900 font-black text-base"><span>Net Payable Amount</span><span>{selectedInvoice.total.toLocaleString()}</span></div>
                <div className="flex justify-between py-1 border-t border-slate-900 text-emerald-600 font-black"><span>Received Amount</span><span>{selectedInvoice.paidAmount.toLocaleString()}</span></div>
                <div className="flex justify-between py-1 border-t border-slate-900 text-rose-600 font-black"><span>Current Due</span><span>{selectedInvoice.dueAmount.toLocaleString()}</span></div>
             </div>
          </div>
          <div className="mt-auto pt-10 flex justify-between px-8"><div className="w-48 text-center border-t border-slate-900 pt-1 font-bold text-[11px] uppercase">Customer Signature</div><div className="w-48 text-center border-t border-slate-900 pt-1 font-bold text-[11px] uppercase">Authorised Signature</div></div>
          <div className="mt-8 pt-2 border-t border-slate-200 text-[8px] flex justify-between text-slate-400 font-bold uppercase">
             <span>Last Added by : {data.shop.preparedBy || 'admin'}</span>
             <span>Print Date & Time : {new Date().toLocaleString()}</span>
             <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden text-left">
        <div className="p-6 border-b border-slate-50 bg-slate-50/20 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1 flex items-center bg-white px-5 py-3 rounded-2xl border shadow-sm max-w-md transition-all focus-within:ring-2 ring-slate-100">
              <div className="text-slate-300 mr-4"><Icons.Search /></div>
              <input type="text" placeholder="SEARCH CUSTOMER, PHONE OR INVOICE..." className="flex-1 bg-transparent outline-none font-black text-[10px] tracking-widest text-slate-900 uppercase placeholder:text-slate-300" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {['all', 'today', '7days', 'month', 'custom'].map(id => (
                <button key={id} onClick={() => setDatePeriod(id as DatePeriod)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${datePeriod === id ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white border text-slate-400 hover:border-slate-300'}`}>{id.toUpperCase()}</button>
              ))}
            </div>
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
                <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No matching records found</td></tr>
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
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoiceHistory;
