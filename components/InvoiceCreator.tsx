
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
  const [extraPymtInfo, setExtraPymtInfo] = useState('');
  const [isImeiDropdownOpen, setIsImeiDropdownOpen] = useState(false);
  const imeiDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingInvoice) {
      setCustomer({ 
        name: editingInvoice.customerName || '', 
        phone: editingInvoice.customerPhone || '',
        address: editingInvoice.customerAddress || '',
        narration: editingInvoice.narration || '', 
      });
      setSelectedItems(editingInvoice.items || []);
      setDiscount(editingInvoice.discount || 0);
      setPaidAmount(editingInvoice.paidAmount || 0);
      const firstPayment = editingInvoice.payments?.[0];
      setPaymentMethod(firstPayment?.method || PaymentMethod.CASH);
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
      drawMetaRow("Entry Time", new Date().toLocaleTimeString(), metaY += rowH);
      drawMetaRow("Bill Status", invoice.dueAmount <= 0 ? "PAID" : "DUE", metaY += rowH);
      
      const pmt = invoice.payments?.[0];
      const pmtText = pmt?.method === PaymentMethod.CASH ? pmt.method : `${pmt?.method} (${pmt?.bankName || pmt?.paymentPhone || 'N/A'})`;
      drawMetaRow("Payment", pmtText, metaY += rowH);

      let custY = currentY;
      const drawCustRow = (label: string, val: string, y: number) => {
        doc.setFont(FONT, "bold").setFontSize(9.5);
        safeText(label, MARGIN, y);
        doc.setFont(FONT, "normal");
        // Fixed alignment for colons
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
    const payment: PaymentDetails = { method: paymentMethod, transactionId: 'N/A', amount: paidAmount, bankName: extraPymtInfo, paymentPhone: extraPymtInfo };
    const inv: Invoice = { 
      id: editingInvoice?.id || Math.random().toString(36).substr(2, 9), 
      invoiceNumber: editingInvoice?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`, 
      date: editingInvoice?.date || new Date().toISOString(), 
      customerName: customer.name, 
      customerPhone: customer.phone, 
      customerAddress: customer.address, 
      narration: customer.narration, 
      items: selectedItems, 
      subtotal, discount, vat: 0, total, payments: [payment], paidAmount, dueAmount
    };
    onCreateInvoice(inv);
    generatePDF(inv);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div><h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{editingInvoice ? 'Modify Bill' : 'New Sale'}</h2><p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2 text-blue-600">Mobile POS Suite</p></div>
        {editingInvoice && <button onClick={onCancelEdit} className="text-rose-500 font-black text-[10px] uppercase tracking-widest bg-rose-50 px-6 py-3 rounded-xl border border-rose-100 hover:bg-rose-100">Cancel Modification</button>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-6 flex items-center"><span className="w-1.5 h-4 bg-slate-900 rounded-full mr-3"></span>Customer Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="tel" placeholder="Mobile Number *" className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-sm transition-all" value={customer.phone} onChange={e => {
                const phone = e.target.value;
                setCustomer(prev => ({ ...prev, phone }));
                if (phone.length >= 4) {
                  const match = data.invoices.find(inv => inv.customerPhone === phone);
                  if (match) setCustomer(prev => ({ 
                    ...prev, 
                    name: match.customerName || prev.name, 
                    address: match.customerAddress || prev.address,
                    narration: match.narration || prev.narration
                  }));
                }
              }} />
              <input type="text" placeholder="Full Name *" className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-sm transition-all" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
              <input type="text" placeholder="Full Address" className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-sm transition-all" value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} />
              <input type="text" placeholder="Narration" className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-sm transition-all" value={customer.narration} onChange={e => setCustomer({...customer, narration: e.target.value})} />
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-6 flex items-center"><span className="w-1.5 h-4 bg-slate-900 rounded-full mr-3"></span>Cart Items</h3>
            <div className="relative mb-6" ref={imeiDropdownRef}>
              <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 focus-within:ring-2 ring-slate-200 transition-all">
                <div className="px-4 text-slate-300 flex items-center"><Icons.Search /></div>
                <input type="text" placeholder="SCAN OR TYPE IMEI TO ADD..." className="bg-transparent py-4 outline-none font-black text-slate-900 text-[10px] uppercase tracking-widest w-full" value={imeiInput} onChange={e => { setImeiInput(e.target.value); setIsImeiDropdownOpen(true); }} onFocus={() => setIsImeiDropdownOpen(true)} />
              </div>
              {isImeiDropdownOpen && imeiInput && (
                <div className="absolute z-[100] left-0 right-0 top-full mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl max-h-60 overflow-y-auto">
                  {data.stocks.filter(s => s.status === StockStatus.AVAILABLE && s.imei.toLowerCase().includes(imeiInput.toLowerCase())).map(s => {
                    const model = data.models.find(m => m.id === s.modelId);
                    return (<button key={s.imei} onClick={() => handleAddItem(s.imei)} className="w-full text-left px-6 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center group"><div><p className="font-black text-slate-900 text-[10px] uppercase">{model?.brand} {model?.modelName}</p><p className="font-mono text-[9px] text-slate-400">{s.imei}</p></div><div className="text-right"><p className="font-black text-slate-900 text-[10px]">{s.sellingPrice.toLocaleString()}</p><p className="text-[8px] font-bold text-slate-300 uppercase">Available</p></div></button>);
                  })}
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest">
                  <tr><th className="px-6 py-4">Item Details</th><th className="px-6 py-4 text-right">Price</th><th className="px-6 py-4 text-center"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedItems.length === 0 ? (<tr><td colSpan={3} className="px-6 py-12 text-center text-slate-300 font-black uppercase tracking-widest">Cart is empty.</td></tr>) : (selectedItems.map((item, idx) => (
                    <tr key={item.imei} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-4">
                        <p className="font-black text-slate-900 uppercase">{item.brand} {item.modelName}</p>
                        <p className="text-[8px] text-slate-400 font-mono">{item.imei}</p>
                      </td>
                      <td className="px-6 py-4 text-right font-black">{item.price.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center"><button onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== idx))} className="text-rose-500 hover:scale-125 transition-transform"><Icons.Trash /></button></td>
                    </tr>
                  )))}
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
                {paymentMethod !== PaymentMethod.CASH && (<div className="space-y-3"><input type="text" placeholder={paymentMethod === PaymentMethod.CARD ? "Bank Name / Card Brand" : "Payment Phone Number"} className="w-full bg-slate-800 text-white p-3 rounded-xl font-bold text-xs outline-none" value={extraPymtInfo} onChange={e => setExtraPymtInfo(e.target.value)} /></div>)}
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
