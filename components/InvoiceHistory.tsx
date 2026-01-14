
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Invoice, PaymentMethod } from '../types';
import { Icons } from '../constants';

const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    const val = Math.floor(n);
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

const InvoiceHistory: React.FC<Props> = ({ data, initialInvoiceId, onClearInitial, onEditInvoice, onDeleteInvoice }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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
      const q = searchQuery.toLowerCase();
      return (inv.customerName || "").toLowerCase().includes(q) || 
             (inv.invoiceNumber || "").toLowerCase().includes(q) || 
             (inv.customerPhone || "").includes(searchQuery);
    }).slice().reverse();
  }, [data.invoices, searchQuery]);

  const generatePDF = (invoice: Invoice) => {
    try {
      const { jsPDF } = (window as any).jspdf;
      if (!jsPDF) return;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const PAGE_WIDTH = doc.internal.pageSize.getWidth();
      const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
      const MARGIN = 10; 
      const FONT = "helvetica";

      const safeText = (text: any, x: number, y: number, o?: any) => doc.text(String(text || "N/A"), x, y, o);

      // --- HEADER ---
      if (data.shop.logoUrl) {
        try {
          doc.addImage(data.shop.logoUrl, MARGIN, 5, 20, 20);
        } catch (e) {
          console.error("Logo Error:", e);
        }
      }
      doc.setTextColor(0); doc.setFont(FONT, "bold").setFontSize(22);
      safeText(data.shop.name.toUpperCase(), PAGE_WIDTH / 2, 12, { align: 'center' });
      doc.setFontSize(9).setFont(FONT, "normal");
      safeText(data.shop.address, PAGE_WIDTH / 2, 17, { align: 'center' });
      doc.setFont(FONT, "bold"); safeText(`Mobile : ${data.shop.phone}`, PAGE_WIDTH / 2, 22, { align: 'center' });
      doc.setFontSize(13); doc.setFont(FONT, "bold");
      doc.line(PAGE_WIDTH / 2 - 25, 31, PAGE_WIDTH / 2 + 25, 31);
      safeText("Sales Invoice", PAGE_WIDTH / 2, 30, { align: 'center' });

      // --- META INFO ---
      const infoW = 60, infoX = PAGE_WIDTH - MARGIN - infoW;
      let infoY = 35;
      const drawInfoRow = (label: string, value: string, y: number) => {
        doc.setFont(FONT, "bold").setFontSize(8);
        doc.rect(infoX, y, infoW/2, 5.5);
        safeText(label, infoX + 2, y + 3.8);
        doc.rect(infoX + infoW/2, y, infoW/2, 5.5);
        doc.setFont(FONT, "normal");
        safeText(value, infoX + infoW/2 + 2, y + 3.8, { maxWidth: infoW/2 - 4 });
      };

      const now = new Date();
      drawInfoRow("Invoice No.", invoice.invoiceNumber, infoY);
      drawInfoRow("Date", new Date(invoice.date).toLocaleDateString('en-GB'), infoY += 5.5);
      drawInfoRow("Prepared By", (data.shop.preparedBy || "ADMIN").toUpperCase(), infoY += 5.5);
      drawInfoRow("Entry Time", now.toLocaleTimeString(), infoY += 5.5);
      drawInfoRow("Bill Status", invoice.dueAmount <= 0 ? "PAID" : "DUE", infoY += 5.5);
      drawInfoRow("Payment Method", invoice.payments?.[0]?.method || "N/A", infoY += 5.5);

      if (invoice.payments?.[0] && invoice.payments[0].method !== PaymentMethod.CASH) {
        const p = invoice.payments[0];
        const detailStr = p.method === PaymentMethod.CARD ? p.bankName : (p.transactionId || p.paymentPhone);
        drawInfoRow("Pymt Details", detailStr || 'N/A', infoY += 5.5);
      }

      // --- CUSTOMER ---
      let currentY = 38;
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
      addCustRow("Narration", invoice.attention || '');

      // --- TABLE ---
      const tableStartY = Math.max(currentY + 5, infoY + 10);
      const itData = invoice.items.map((it, i) => [
        i + 1, 
        `${it.brand} ${it.modelName}\nS/N: ${it.imei}`, 
        '1.00', 
        formatAmount(it.price)
      ]);

      (doc as any).autoTable({
        startY: tableStartY, margin: { left: MARGIN, right: MARGIN },
        head: [['SL', 'DESCRIPTION', 'QTY', 'AMOUNT']],
        body: itData, theme: 'grid', 
        headStyles: { fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8.5, font: FONT, lineWidth: 0.1, cellPadding: 2, textColor: 0, overflow: 'linebreak' },
        columnStyles: { 
          0: { cellWidth: 10, halign: 'center' }, 
          1: { cellWidth: 'auto', fontStyle: 'bold' }, 
          2: { cellWidth: 20, halign: 'center' }, 
          3: { cellWidth: 35, halign: 'right' } 
        }
      });

      // --- FOOTER SUMMARY ---
      let fY = (doc as any).lastAutoTable.finalY;
      const sumW = 75, sumX = PAGE_WIDTH - MARGIN - sumW;
      
      doc.rect(MARGIN, fY, PAGE_WIDTH - MARGIN * 2, 8);
      doc.setFont(FONT, "bold").setFontSize(9);
      safeText(`TOTAL ITEM QUANTITY :  ${invoice.items.length.toFixed(2)}`, MARGIN + 40, fY + 5.5);
      
      let curSY = fY + 18;
      const drawSumRow = (label: string, val: string, y: number, isBold: boolean = false) => {
        doc.setFont(FONT, isBold ? "bold" : "normal").setFontSize(8.5);
        doc.rect(sumX, y, sumW - 25, 6.5); safeText(label, sumX + 2, y + 4.5);
        doc.rect(sumX + sumW - 25, y, 25, 6.5); safeText(val, sumX + sumW - 2, y + 4.5, { align: 'right' });
      };

      drawSumRow("TOTAL AMOUNT", formatAmount(invoice.subtotal), curSY, true);
      drawSumRow("LESS DISCOUNT (-)", formatAmount(invoice.discount), curSY += 6.5);
      drawSumRow("NET PAYABLE", formatAmount(invoice.total), curSY += 6.5, true);
      drawSumRow("RECEIVED AMOUNT", formatAmount(invoice.paidAmount), curSY += 6.5, true);
      drawSumRow("CURRENT DUE", formatAmount(invoice.dueAmount), curSY += 6.5, true);

      doc.setFont(FONT, "bold").setFontSize(9); safeText(`Taka In Word :`, MARGIN, fY + 22.5);
      doc.setFont(FONT, "italic");
      const wordLines = doc.splitTextToSize(numberToWords(invoice.total), sumX - MARGIN - 10);
      doc.text(wordLines, MARGIN, fY + 27.5);

      // --- SIGNATURES ---
      const sigY = PAGE_HEIGHT - 35;
      doc.line(MARGIN, sigY, MARGIN + 45, sigY); doc.line(PAGE_WIDTH - MARGIN - 45, sigY, PAGE_WIDTH - MARGIN, sigY);
      doc.setFontSize(9).setFont(FONT, "bold"); safeText("Customer Signature", MARGIN + 5, sigY + 5); safeText("Authorised Signature", PAGE_WIDTH - MARGIN - 40, sigY + 5);

      // --- SYSTEM FOOTER ---
      const bottomLineY = PAGE_HEIGHT - 12;
      doc.setDrawColor(230);
      doc.line(MARGIN, bottomLineY, PAGE_WIDTH - MARGIN, bottomLineY);
      doc.setFontSize(7).setFont(FONT, "bold").setTextColor(180);
      safeText(`PRINTED BY: ${(data.shop.preparedBy || 'ADMIN').toUpperCase()}`, MARGIN, PAGE_HEIGHT - 8);
      safeText(new Date().toLocaleString('en-GB'), PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' });
      safeText("PAGE 1 OF 1", PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' });

      window.open(doc.output('bloburl'), '_blank');
    } catch (e) { console.error(e); }
  };

  if (selectedInvoice) {
    const mainPymt = selectedInvoice.payments?.[0];

    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-10">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            #invoice-print-area { display: flex !important; flex-direction: column !important; height: 100% !important; }
            .page-break-avoid { page-break-inside: avoid !important; }
          }
        `}} />
        <div className="flex justify-between items-center no-print bg-white p-4 rounded-xl border shadow-sm sticky top-0 z-[40]">
          <button onClick={() => setSelectedInvoice(null)} className="text-slate-500 hover:text-slate-900 font-bold flex items-center transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg> Back to List
          </button>
          <div className="flex space-x-2">
            <button onClick={() => onEditInvoice(selectedInvoice)} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">Edit</button>
            <button onClick={() => generatePDF(selectedInvoice)} className="bg-slate-900 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">Print (PDF)</button>
            <button onClick={() => window.print()} className="bg-slate-100 text-slate-900 px-5 py-2 rounded-lg font-bold text-sm transition-all">Print (A4 Browser)</button>
            <button onClick={() => setDeleteConfirmId(selectedInvoice.id)} className="bg-rose-50 text-rose-600 px-5 py-2 rounded-lg font-bold text-sm transition-all">Delete</button>
          </div>
        </div>

        <div id="invoice-print-area" className="bg-white max-w-[794px] w-full mx-auto p-10 border shadow-2xl rounded-sm text-slate-900 min-h-[1123px] flex flex-col box-border font-sans print:p-8 print:shadow-none print:border-none print:m-0">
          <div className="flex items-center justify-between mb-8 border-b-2 border-slate-900 pb-6 page-break-avoid">
            <div className="w-24">{data.shop.logoUrl && <img src={data.shop.logoUrl} className="w-full h-auto object-contain" alt="Logo" />}</div>
            <div className="flex-1 text-center px-4">
              <h1 className="text-4xl font-black uppercase mb-1 tracking-tighter">{data.shop.name}</h1>
              <p className="text-[12px] font-semibold text-slate-600 leading-tight">{data.shop.address}</p>
              <p className="text-[12px] font-bold mt-1">Mobile: {data.shop.phone} | Email: {data.shop.email || 'N/A'}</p>
            </div>
            <div className="w-24"></div> 
          </div>

          <div className="text-center mb-10 page-break-avoid">
            <span className="border-4 border-slate-900 px-10 py-1.5 text-2xl font-black uppercase tracking-[0.2em]">Sales Invoice</span>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-10 items-start page-break-avoid">
            <div className="space-y-2 text-[14px]">
              <div className="flex border-b border-slate-100 pb-1"><span className="font-bold w-24 flex-shrink-0">Customer</span><span className="font-black flex-1">: {selectedInvoice.customerName}</span></div>
              <div className="flex border-b border-slate-100 pb-1"><span className="font-bold w-24 flex-shrink-0">Address</span><span className="font-medium flex-1 overflow-wrap-anywhere">: {selectedInvoice.customerAddress || 'N/A'}</span></div>
              <div className="flex border-b border-slate-100 pb-1"><span className="font-bold w-24 flex-shrink-0">Mobile</span><span className="font-bold flex-1">: {selectedInvoice.customerPhone}</span></div>
              <div className="flex border-b border-slate-100 pb-1"><span className="font-bold w-24 flex-shrink-0">Narration</span><span className="font-medium flex-1">: {selectedInvoice.attention || 'N/A'}</span></div>
            </div>
            
            <div className="border-2 border-slate-900 rounded-sm overflow-hidden text-[12px]">
               <div className="flex border-b-2 border-slate-900"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900">INVOICE NO.</div><div className="w-1/2 p-2 font-bold uppercase">{selectedInvoice.invoiceNumber}</div></div>
               <div className="flex border-b-2 border-slate-900"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900">DATE</div><div className="w-1/2 p-2 font-bold">{new Date(selectedInvoice.date).toLocaleDateString('en-GB')}</div></div>
               <div className="flex border-b-2 border-slate-900"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900">PREPARED BY</div><div className="w-1/2 p-2 font-bold uppercase">{(data.shop.preparedBy || 'ADMIN')}</div></div>
               <div className="flex border-b-2 border-slate-900"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900">BILL STATUS</div><div className="w-1/2 p-2 font-black text-blue-700">{selectedInvoice.dueAmount > 0 ? 'DUE' : 'PAID'}</div></div>
               <div className="flex border-b-2 border-slate-900"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900">METHOD</div><div className="w-1/2 p-2 font-bold uppercase">{mainPymt?.method || 'CASH'}</div></div>
               {mainPymt && mainPymt.method !== PaymentMethod.CASH && (
                 <div className="flex"><div className="w-1/2 p-2 bg-slate-50 font-black border-r-2 border-slate-900 uppercase">DETAILS</div><div className="w-1/2 p-2 font-bold uppercase">{mainPymt.method === PaymentMethod.CARD ? mainPymt.bankName : (mainPymt.transactionId || mainPymt.paymentPhone)}</div></div>
               )}
            </div>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900 mb-6 table-fixed">
            <thead className="bg-slate-50">
              <tr className="text-[12px] font-black uppercase text-center">
                <th className="border-2 border-slate-900 p-2 w-[8%]">SL</th>
                <th className="border-2 border-slate-900 p-2 w-[62%] text-left">DESCRIPTION</th>
                <th className="border-2 border-slate-900 p-2 w-[10%]">QTY</th>
                <th className="border-2 border-slate-900 p-2 w-[20%] text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="text-[12px] font-medium uppercase">
              {selectedInvoice.items.map((it, i) => (
                <tr key={i}>
                  <td className="border-2 border-slate-900 p-2 text-center">{i+1}</td>
                  <td className="border-2 border-slate-900 p-2 whitespace-pre-wrap leading-tight">
                    <span className="font-black text-slate-900 text-[13px]">{it.brand} {it.modelName}</span><br/>
                    <span className="text-[10px] text-slate-400">S/N: {it.imei}</span>
                  </td>
                  <td className="border-2 border-slate-900 p-2 text-center font-bold">1.00</td>
                  <td className="border-2 border-slate-900 p-2 text-right font-black">{it.price.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-black text-[13px]">
                <td colSpan={2} className="border-2 border-slate-900 p-3 text-right uppercase">TOTAL ITEM QUANTITY:</td>
                <td className="border-2 border-slate-900 p-3 text-center">{selectedInvoice.items.length.toFixed(2)}</td>
                <td className="border-2 border-slate-900 p-3 text-right">{selectedInvoice.subtotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between items-start mt-16 mb-10 gap-10 page-break-avoid">
            <div className="flex-1 pt-4">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Taka In Word :</p>
              <p className="text-[14px] font-bold italic border-b-2 border-dotted border-slate-400 pb-2">{numberToWords(selectedInvoice.total)}</p>
            </div>
            <div className="w-80 space-y-0 text-[13px] border-2 border-slate-900 rounded-sm overflow-hidden">
               <div className="flex justify-between p-2 border-b border-slate-200"><span>TOTAL AMOUNT</span><span className="font-bold">{formatAmount(selectedInvoice.subtotal)}</span></div>
               <div className="flex justify-between p-2 border-b border-slate-200"><span>LESS DISCOUNT (-)</span><span className="font-bold">{formatAmount(selectedInvoice.discount)}</span></div>
               <div className="flex justify-between p-2 bg-slate-900 text-white font-black text-xl tracking-tighter"><span>NET PAYABLE</span><span>{formatAmount(selectedInvoice.total)}</span></div>
               <div className="flex justify-between p-2 border-b border-slate-200 bg-emerald-50 font-bold text-emerald-800"><span>RECEIVED AMOUNT</span><span>{formatAmount(selectedInvoice.paidAmount)}</span></div>
               <div className="flex justify-between p-2 font-black text-rose-700 bg-rose-50"><span>CURRENT DUE</span><span>{formatAmount(selectedInvoice.dueAmount)}</span></div>
            </div>
          </div>

          <div className="mt-auto pt-20 flex justify-between px-8 page-break-avoid">
            <div className="w-48 text-center border-t-2 border-slate-900 pt-2 font-black uppercase text-[11px]">Customer Signature</div>
            <div className="w-48 text-center border-t-2 border-slate-900 pt-2 font-black uppercase text-[11px]">Authorized Signature</div>
          </div>
          
          <div className="mt-12 pt-4 border-t border-slate-100 flex justify-between text-[9px] font-black text-slate-300 uppercase tracking-widest print:opacity-50">
            <span>PRINTED BY: {(data.shop.preparedBy || 'SYSTEM').toUpperCase()}</span>
            <span>{new Date().toLocaleString('en-GB')}</span>
            <span>PAGE 1 OF 1</span>
          </div>
        </div>

        {deleteConfirmId && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border-4 border-rose-500 animate-in zoom-in duration-200 text-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase mb-4">Delete Invoice?</h3>
              <p className="text-slate-500 text-sm mb-8">This will return the items to available stock. Proceed?</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => { onDeleteInvoice(deleteConfirmId); setDeleteConfirmId(null); setSelectedInvoice(null); }} className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black uppercase text-xs">Confirm Delete</button>
                <button onClick={() => setDeleteConfirmId(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in duration-500">
      <div className="p-6 border-b border-slate-50 bg-slate-50/20">
        <div className="flex items-center bg-white px-5 py-3 rounded-2xl border shadow-sm max-w-md">
          <div className="text-slate-300 mr-4"><Icons.Search /></div>
          <input type="text" placeholder="SEARCH BY NAME, PHONE OR INVOICE..." className="flex-1 bg-transparent outline-none font-black text-[10px] tracking-widest text-slate-900 uppercase" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Invoice No</th>
              <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
              <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
              <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredInvoices.length === 0 ? (
              <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No matching invoices found</td></tr>
            ) : (
              filteredInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-all group cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                  <td className="px-8 py-5 font-black text-blue-600 text-xs uppercase">{inv.invoiceNumber}</td>
                  <td className="px-8 py-5"><p className="font-bold text-slate-900 text-xs uppercase">{inv.customerName}</p><p className="text-[9px] text-slate-400 font-bold">{inv.customerPhone}</p></td>
                  <td className="px-8 py-5 text-right font-black text-slate-900 text-xs">{inv.total.toLocaleString()}</td>
                  <td className="px-8 py-5 text-center"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${inv.dueAmount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{inv.dueAmount > 0 ? `DUE` : 'PAID'}</span></td>
                  <td className="px-8 py-5 text-center"><div className="flex justify-center space-x-3 text-slate-300"><button onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }} className="hover:text-slate-900"><Icons.Print /></button><button onClick={(e) => { e.stopPropagation(); onEditInvoice(inv); }} className="hover:text-blue-600"><Icons.Settings /></button></div></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceHistory;
