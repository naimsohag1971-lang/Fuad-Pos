
import React, { useState, useEffect, useRef } from 'react';
import { AppData, Invoice, InvoiceItem, PaymentMethod, StockStatus, PaymentDetails } from '../types';
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
  onCreateInvoice: (invoice: Invoice) => void;
  editingInvoice?: Invoice | null;
  onCancelEdit?: () => void;
}

const InvoiceCreator: React.FC<Props> = ({ data, onCreateInvoice, editingInvoice, onCancelEdit }) => {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', narration: '' });
  const [imeiInput, setImeiInput] = useState('');
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [txnId, setTxnId] = useState('');
  const [extraPymtInfo, setExtraPymtInfo] = useState('');
  const [isImeiDropdownOpen, setIsImeiDropdownOpen] = useState(false);
  const imeiDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingInvoice) {
      setCustomer({ 
        name: editingInvoice.customerName || '', 
        phone: editingInvoice.customerPhone || '',
        address: editingInvoice.customerAddress || '',
        narration: editingInvoice.attention || ''
      });
      setSelectedItems(editingInvoice.items || []);
      setDiscount(editingInvoice.discount || 0);
      setPaidAmount(editingInvoice.paidAmount || 0);
      const firstPayment = editingInvoice.payments?.[0];
      setPaymentMethod(firstPayment?.method || PaymentMethod.CASH);
      setTxnId(firstPayment?.transactionId || '');
      setExtraPymtInfo(firstPayment?.bankName || firstPayment?.paymentPhone || '');
    }
  }, [editingInvoice]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (imeiDropdownRef.current && !imeiDropdownRef.current.contains(event.target as Node)) {
        setIsImeiDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePhoneChange = (phone: string) => {
    setCustomer(prev => ({ ...prev, phone }));
    if (phone.length >= 4) {
      const match = data.invoices.find(inv => inv.customerPhone === phone);
      if (match) setCustomer(prev => ({ 
        ...prev, 
        name: match.customerName || prev.name, 
        address: match.customerAddress || prev.address,
        narration: match.attention || prev.narration
      }));
    }
  };

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

      // --- SHOP HEADER ---
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

      // --- META INFO ---
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
      drawInfoRow("Entry Time", new Date().toLocaleTimeString(), metaY += 5.5);
      drawInfoRow("Bill Status", invoice.dueAmount <= 0 ? "PAID" : "DUE", metaY += 5.5);
      drawInfoRow("Payment Method", invoice.payments?.[0]?.method || "N/A", metaY += 5.5);

      // --- CUSTOMER ---
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
      const tableStartY = Math.max(currentY + 5, metaY + 10);
      const itData: any[] = invoice.items.map((it, i) => [
        i + 1, 
        { content: `${it.brand} ${it.modelName}\nS/N: ${it.imei}`, styles: { fontStyle: 'bold' } },
        '1.00', 
        formatAmount(it.price)
      ]);

      itData.push([
        { 
          content: 'TOTAL ITEM QUANTITY:', 
          colSpan: 2, 
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } 
        },
        { 
          content: invoice.items.length.toFixed(2), 
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } 
        },
        { 
          content: formatAmount(invoice.subtotal), 
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] } 
        }
      ]);

      (doc as any).autoTable({
        startY: tableStartY, margin: { left: MARGIN, right: MARGIN },
        head: [['SL', 'DESCRIPTION', 'QTY', 'AMOUNT']],
        body: itData, theme: 'grid', 
        headStyles: { fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8.5, font: FONT, lineWidth: 0.1, cellPadding: 2.5, textColor: 0, overflow: 'linebreak' },
        columnStyles: { 
          0: { cellWidth: 10, halign: 'center' }, 
          1: { cellWidth: 'auto' }, 
          2: { cellWidth: 20, halign: 'center' }, 
          3: { cellWidth: 35, halign: 'right' } 
        }
      });

      // --- SUMMARY ---
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
    } catch (e) { console.error("PDF Error:", e); }
  };

  const subtotal = selectedItems.reduce((sum, it) => sum + it.price, 0);
  const total = subtotal - discount;
  const dueAmount = total - paidAmount;

  const handleAddItem = (imei: string) => {
    const stock = data.stocks.find(s => s.imei === imei && s.status === StockStatus.AVAILABLE);
    if (!stock) { alert("Invalid or Unavailable IMEI"); return; }
    const model = data.models.find(m => m.id === stock.modelId);
    setSelectedItems([...selectedItems, { imei: stock.imei, modelName: model?.modelName || 'Unknown', brand: model?.brand || 'Unknown', price: stock.sellingPrice }]);
    setImeiInput('');
    setIsImeiDropdownOpen(false);
  };

  const handleCreate = () => {
    if (!customer.name || !customer.phone || selectedItems.length === 0) { alert("Fill customer details and add items."); return; }
    const payment: PaymentDetails = { method: paymentMethod, transactionId: txnId, amount: paidAmount, bankName: extraPymtInfo, paymentPhone: extraPymtInfo };
    const inv: Invoice = { id: editingInvoice?.id || Math.random().toString(36).substr(2, 9), invoiceNumber: editingInvoice?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`, date: editingInvoice?.date || new Date().toISOString(), customerName: customer.name, customerPhone: customer.phone, customerAddress: customer.address, attention: customer.narration, items: selectedItems, subtotal, discount, vat: 0, total, payments: [payment], paidAmount, dueAmount };
    onCreateInvoice(inv);
    generatePDF(inv);
  };

  const filteredStock = data.stocks.filter(s => s.status === StockStatus.AVAILABLE && s.imei.toLowerCase().includes(imeiInput.toLowerCase()) && !selectedItems.some(item => item.imei === s.imei));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div><h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{editingInvoice ? 'Modify Bill' : 'New Sale'}</h2><p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Retail Point of Sale</p></div>
        {editingInvoice && <button onClick={onCancelEdit} className="text-rose-500 font-black text-[10px] uppercase tracking-widest bg-rose-50 px-6 py-3 rounded-xl border border-rose-100 hover:bg-rose-100">Cancel Modification</button>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-6 flex items-center"><span className="w-1.5 h-4 bg-slate-900 rounded-full mr-3"></span>Customer Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="tel" placeholder="Mobile Number *" className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-[11px] transition-all" value={customer.phone} onChange={e => handlePhoneChange(e.target.value)} />
              <input type="text" placeholder="Full Name *" className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-[11px] transition-all" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
              <input type="text" placeholder="Full Address" className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-[11px] transition-all md:col-span-2" value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} />
              <input type="text" placeholder="Internal Narration" className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-[11px] transition-all md:col-span-2" value={customer.narration} onChange={e => setCustomer({...customer, narration: e.target.value})} />
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-6 flex items-center"><span className="w-1.5 h-4 bg-slate-900 rounded-full mr-3"></span>Cart Items</h3>
            <div className="relative mb-6" ref={imeiDropdownRef}>
              <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 focus-within:ring-2 ring-slate-200 transition-all">
                <div className="px-4 text-slate-300 flex items-center"><Icons.Search /></div>
                <input type="text" placeholder="SCAN OR TYPE IMEI TO ADD..." className="bg-transparent py-4 outline-none font-black text-slate-900 text-[10px] uppercase tracking-widest w-full" value={imeiInput} onChange={e => { setImeiInput(e.target.value); setIsImeiDropdownOpen(true); }} onFocus={() => setIsImeiDropdownOpen(true)} />
              </div>
              {isImeiDropdownOpen && filteredStock.length > 0 && (
                <div className="absolute z-[100] left-0 right-0 top-full mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl max-h-60 overflow-y-auto">
                  {filteredStock.map(s => {
                    const model = data.models.find(m => m.id === s.modelId);
                    return (<button key={s.imei} onClick={() => handleAddItem(s.imei)} className="w-full text-left px-6 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center group"><div><p className="font-black text-slate-900 text-[10px] uppercase">{model?.brand} {model?.modelName}</p><p className="font-mono text-[9px] text-slate-400">{s.imei}</p></div><div className="text-right"><p className="font-black text-slate-900 text-[10px]">{s.sellingPrice.toLocaleString()}</p><p className="text-[8px] font-bold text-slate-300 uppercase">Available</p></div></button>);
                  })}
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest">
                  <tr><th className="px-6 py-4">Item Details</th><th className="px-6 py-4">Serial (IMEI)</th><th className="px-6 py-4 text-right">Price</th><th className="px-6 py-4 text-center"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedItems.length === 0 ? (<tr><td colSpan={4} className="px-6 py-12 text-center text-slate-300 font-black uppercase tracking-widest">Cart is empty.</td></tr>) : (selectedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-all"><td className="px-6 py-4"><p className="font-black text-slate-900 uppercase">{item.brand} {item.modelName}</p></td><td className="px-6 py-4 font-mono text-slate-500 uppercase">{item.imei}</td><td className="px-6 py-4 text-right font-black">{item.price.toLocaleString()}</td><td className="px-6 py-4 text-center"><button onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== idx))} className="text-rose-500 hover:scale-125 transition-transform"><Icons.Trash /></button></td></tr>
                  )))}
                  {selectedItems.length > 0 && (
                    <tr className="bg-slate-50/50 font-black">
                      <td colSpan={2} className="px-6 py-4 text-right uppercase tracking-widest text-slate-400">Total Item Quantity:</td>
                      <td className="px-6 py-4 text-right text-slate-900">{selectedItems.length.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white h-fit sticky top-6 space-y-8 border border-slate-800">
           <div className="space-y-1"><h3 className="text-lg font-black tracking-tighter uppercase leading-tight">Checkout</h3><p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">Transaction Ledger</p></div>
           <div className="space-y-4">
              <div className="flex justify-between items-center text-[11px] font-black uppercase text-slate-400"><span>Subtotal</span><span className="text-white">{subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between items-center text-[11px] font-black uppercase"><span className="text-slate-400">Discount (-)</span><input type="number" className="bg-slate-800 border-none outline-none p-2 rounded-xl text-right font-black text-white w-24 text-[11px]" value={discount || ''} onChange={e => setDiscount(Number(e.target.value))} /></div>
              <div className="pt-6 border-t border-slate-800 flex justify-between items-end"><div><p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Net Payable</p><p className="text-4xl font-black text-white tracking-tighter">{total.toLocaleString()}</p></div></div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4 mt-8">
                <div><label className="text-[9px] font-black text-slate-500 uppercase block mb-2 tracking-widest">Payment Method</label><select className="w-full bg-slate-800 text-white p-3 rounded-xl font-bold text-xs outline-none" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>{Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                {paymentMethod !== PaymentMethod.CASH && (<div className="space-y-3"><input type="text" placeholder={paymentMethod === PaymentMethod.CARD ? "Bank Name" : "Payment Phone"} className="w-full bg-slate-800 text-white p-3 rounded-xl font-bold text-xs outline-none" value={extraPymtInfo} onChange={e => setExtraPymtInfo(e.target.value)} /><input type="text" placeholder="Transaction ID" className="w-full bg-slate-800 text-white p-3 rounded-xl font-bold text-xs outline-none" value={txnId} onChange={e => setTxnId(e.target.value)} /></div>)}
                <div><label className="text-[9px] font-black text-emerald-400 uppercase block mb-2 tracking-widest">Cash Received</label><input type="number" placeholder="0" className="w-full bg-transparent border-b-2 border-emerald-500 font-black text-2xl outline-none p-0 pb-1 text-white" value={paidAmount || ''} onChange={e => setPaidAmount(Number(e.target.value))} /></div>
                <div className="flex justify-between items-center"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Customer Due</p><p className={`text-sm font-black uppercase ${dueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{dueAmount > 0 ? `BDT ${dueAmount.toLocaleString()}` : 'SETTLED'}</p></div>
              </div>
           </div>
           <button disabled={selectedItems.length === 0} onClick={handleCreate} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-blue-500 transition-all active:scale-[0.97] disabled:opacity-20">{editingInvoice ? 'UPDATE & PRINT' : 'FINALIZE & PRINT'}</button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCreator;
