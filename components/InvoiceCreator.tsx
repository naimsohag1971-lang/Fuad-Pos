import React, { useState, useEffect, useRef } from 'react';
import { AppData, Invoice, InvoiceItem, PaymentMethod, StockStatus, PaymentDetails } from '../types';
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
  onCreateInvoice: (invoice: Invoice) => void;
  editingInvoice?: Invoice | null;
  onCancelEdit?: () => void;
}

const InvoiceCreator: React.FC<Props> = ({ data, onCreateInvoice, editingInvoice, onCancelEdit }) => {
  const [customer, setCustomer] = useState({ 
    name: '', 
    phone: '', 
    address: '', 
    narration: ''
  });
  const [imeiInput, setImeiInput] = useState('');
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [txnId, setTxnId] = useState('');
  const [extraPymtInfo, setExtraPymtInfo] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
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

      const safeText = (text: any, x: number, y: number, o?: any) => doc.text(String(text || "N/A"), x, y, o);

      // --- HEADER ---
      if (data.shop.logoUrl) doc.addImage(data.shop.logoUrl, 'PNG', MARGIN, 5, 20, 20);
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

      // --- TABLE REDESIGN ---
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

  const handleAddIMEI = (targetImei?: string) => {
    const imeiToUse = targetImei || imeiInput.trim();
    if (!imeiToUse) return;
    const stock = data.stocks.find(s => s.imei === imeiToUse);
    if (!stock) return alert("IMEI not found!");
    if (stock.status !== StockStatus.AVAILABLE && !editingInvoice?.items.some(i => i.imei === imeiToUse)) return alert("Sold!");
    if (selectedItems.find(item => item.imei === imeiToUse)) return alert("In cart.");
    const model = data.models.find(m => m.id === stock.modelId);
    if (model) {
      setSelectedItems([...selectedItems, { imei: stock.imei, modelName: model.modelName, brand: model.brand, price: stock.sellingPrice || model.sellingPrice }]);
      setImeiInput('');
      setIsImeiDropdownOpen(false);
    }
  };

  const validateAndConfirm = () => {
    if (!customer.name.trim() || !customer.phone.trim()) {
      alert("Required: Customer Name and Mobile Number are mandatory.");
      return;
    }
    if (selectedItems.length === 0) {
      alert("Required: Add at least one item to the bill.");
      return;
    }
    setIsConfirming(true);
  };

  const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal - discount;
  const paid = paidAmount || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{editingInvoice ? 'Edit Bill' : 'New Bill'}</h2>
        {editingInvoice && <button onClick={onCancelEdit} className="text-rose-500 font-black text-[10px] uppercase tracking-widest px-4 py-2 bg-rose-50 rounded-xl">Cancel Edit</button>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm relative overflow-hidden">
            {data.shop.logoUrl && <img src={data.shop.logoUrl} className="absolute top-8 left-8 w-20 h-20 opacity-50 pointer-events-none object-contain" alt="Branding" />}
            <div className="relative z-10">
              <h3 className="text-lg font-black mb-6 uppercase flex items-center ml-24"><span className="w-1.5 h-6 bg-blue-600 mr-3 rounded-full"></span>Buyer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-24">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Mobile Number *</label>
                  <input type="tel" placeholder="01XXXXXXXXX" className="w-full px-5 py-3 bg-slate-50 rounded-2xl outline-none font-bold border-2 border-transparent focus:border-blue-500 transition-all" value={customer.phone} onChange={e => handlePhoneChange(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Customer Name *</label>
                  <input type="text" placeholder="Full Name" className="w-full px-5 py-3 bg-slate-50 rounded-2xl outline-none font-bold border-2 border-transparent focus:border-blue-500 transition-all" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Customer Address (Optional)</label>
                  <textarea placeholder="N/A" className="w-full px-5 py-3 bg-slate-50 border rounded-2xl outline-none font-bold" rows={1} value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Narration (Optional)</label>
                  <input type="text" placeholder="N/A" className="w-full px-5 py-3 bg-slate-50 rounded-2xl outline-none font-bold border-2 border-transparent focus:border-blue-500 transition-all" value={customer.narration} onChange={e => setCustomer({...customer, narration: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
             <h3 className="text-lg font-black mb-6 uppercase flex items-center"><span className="w-1.5 h-6 bg-blue-600 mr-3 rounded-full"></span>Item Entry</h3>
             <div className="flex space-x-3 mb-8 relative" ref={imeiDropdownRef}>
              <div className="flex-1 relative">
                <input type="text" placeholder="Scan or Search IMEI..." className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" value={imeiInput} onChange={e => { setImeiInput(e.target.value); setIsImeiDropdownOpen(true); }} onFocus={() => setIsImeiDropdownOpen(true)} onKeyDown={e => e.key === 'Enter' && handleAddIMEI()} />
                {isImeiDropdownOpen && (
                  <div className="absolute z-[60] left-0 right-0 top-full mt-2 bg-white border shadow-2xl rounded-2xl max-h-60 overflow-y-auto">
                    {data.stocks.filter(s => s.status === StockStatus.AVAILABLE && s.imei.includes(imeiInput)).map(s => (
                      <button key={s.imei} type="button" className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex flex-col" onMouseDown={() => handleAddIMEI(s.imei)}>
                        <span className="font-black text-slate-900 text-xs">{s.imei}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{data.models.find(m => m.id === s.modelId)?.brand} {data.models.find(m => m.id === s.modelId)?.modelName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => handleAddIMEI()} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Add Item</button>
            </div>
            <table className="w-full text-left">
              <thead><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="p-4">Description</th><th className="p-4 text-right">Price</th><th className="p-4"></th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {selectedItems.length === 0 ? (
                  <tr><td colSpan={3} className="p-10 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">Your cart is empty</td></tr>
                ) : (
                  selectedItems.map(item => (
                    <tr key={item.imei}><td className="p-4"><p className="font-black text-slate-900 uppercase text-xs">{item.brand} {item.modelName}</p><p className="text-[10px] text-slate-400">IMEI: {item.imei}</p></td><td className="p-4 text-right font-black">{item.price.toLocaleString()}</td><td className="p-4 text-center"><button onClick={() => setSelectedItems(selectedItems.filter(i => i.imei !== item.imei))} className="text-rose-500 p-2"><Icons.Trash /></button></td></tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white h-fit space-y-6">
          <h3 className="text-lg font-black text-blue-400 uppercase">Settlement</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center"><span className="text-slate-400 font-bold text-[10px] uppercase">Discount</span><input type="number" className="w-24 p-2 bg-slate-800 rounded-xl text-right font-black text-white outline-none" value={discount || ''} onChange={e => setDiscount(Number(e.target.value))} /></div>
            <div className="pt-6 border-t border-slate-800 flex justify-between items-end"><span className="text-[10px] font-black text-slate-400 uppercase">Final Total</span><span className="text-3xl font-black">{total.toLocaleString()}</span></div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Paid Amount</label>
              <input type="number" className="w-full p-4 bg-blue-600 rounded-2xl text-2xl font-black text-center outline-none ring-offset-2 focus:ring-4 ring-blue-500/50" value={paidAmount || ''} onChange={e => setPaidAmount(Number(e.target.value))} />
            </div>
            <div className="mt-4 space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Method</label>
              <select className="w-full p-3 bg-slate-800 rounded-xl text-xs font-bold uppercase outline-none" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            {paymentMethod !== PaymentMethod.CASH && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Transaction ID / Mobile No</label>
                  <input type="text" className="w-full p-3 bg-slate-800 rounded-xl text-xs font-bold outline-none border border-slate-700" value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="TrxID or Number" />
                </div>
                {paymentMethod === PaymentMethod.CARD ? (
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Bank Name</label>
                    <input type="text" className="w-full p-3 bg-slate-800 rounded-xl text-xs font-bold outline-none border border-slate-700" value={extraPymtInfo} onChange={e => setExtraPymtInfo(e.target.value)} placeholder="e.g. City Bank" />
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Mobile Number (Sender)</label>
                    <input type="text" className="w-full p-3 bg-slate-800 rounded-xl text-xs font-bold outline-none border border-slate-700" value={extraPymtInfo} onChange={e => setExtraPymtInfo(e.target.value)} placeholder="01XXXXXXXXX" />
                  </div>
                )}
              </div>
            )}
            
            <button onClick={validateAndConfirm} className="mt-8 w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-[2rem] uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Verify & Print</button>
          </div>
        </div>
      </div>

      {isConfirming && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] max-w-md w-full p-10 shadow-2xl animate-in zoom-in duration-200 text-center">
            <h3 className="text-2xl font-black text-slate-900 uppercase mb-8">Confirm Sale</h3>
            <div className="space-y-4 mb-10 text-left">
              <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-400 font-bold text-xs uppercase">Payable</span><span className="font-black text-slate-900">{total.toLocaleString()}</span></div>
              <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-400 font-bold text-xs uppercase">Received</span><span className="font-black text-emerald-600">{paid.toLocaleString()}</span></div>
              <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-400 font-bold text-xs uppercase">Balance Due</span><span className="font-black text-rose-600">{(total - paid).toLocaleString()}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirming(false)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs">Cancel</button>
              <button onClick={() => { 
                const shopInitials = data.shop.name.split(' ').map(w => w[0]).join('').toUpperCase() || 'M';
                const payment: PaymentDetails = { 
                  method: paymentMethod, 
                  transactionId: txnId || ('TXN'+Date.now()), 
                  amount: paid 
                };
                if (paymentMethod === PaymentMethod.CARD) {
                  payment.bankName = extraPymtInfo;
                } else if (paymentMethod !== PaymentMethod.CASH) {
                  payment.paymentPhone = extraPymtInfo;
                }

                const invoice: Invoice = {
                  id: editingInvoice?.id || Math.random().toString(36).substr(2, 9),
                  invoiceNumber: editingInvoice?.invoiceNumber || `${shopInitials}${Date.now().toString().slice(-8)}`,
                  date: new Date().toISOString(),
                  customerName: customer.name, 
                  customerPhone: customer.phone, 
                  customerAddress: customer.address || '', 
                  attention: customer.narration || '',
                  items: selectedItems, 
                  subtotal, 
                  discount, 
                  vat: 0, 
                  total, 
                  payments: [payment], 
                  paidAmount: paid, 
                  dueAmount: total - paid
                };
                
                onCreateInvoice(invoice);
                generatePDF(invoice);
                setIsConfirming(false);
              }} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl">Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCreator;