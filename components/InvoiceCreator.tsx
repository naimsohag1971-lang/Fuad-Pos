
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
  onCreateInvoice: (invoice: Invoice) => void;
  editingInvoice?: Invoice | null;
  onCancelEdit?: () => void;
}

const InvoiceCreator: React.FC<Props> = ({ data, onCreateInvoice, editingInvoice, onCancelEdit }) => {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', attention: '' });
  const [imeiInput, setImeiInput] = useState('');
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [bankName, setBankName] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isImeiDropdownOpen, setIsImeiDropdownOpen] = useState(false);
  const imeiDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingInvoice) {
      setCustomer({ 
        name: editingInvoice.customerName || '', 
        phone: editingInvoice.customerPhone || '',
        address: editingInvoice.customerAddress || '',
        attention: editingInvoice.attention || ''
      });
      setSelectedItems(editingInvoice.items || []);
      setDiscount(editingInvoice.discount || 0);
      setPaidAmount(editingInvoice.paidAmount || 0);
      const firstPayment = editingInvoice.payments?.[0];
      setPaymentMethod(firstPayment?.method || PaymentMethod.CASH);
      setBankName(firstPayment?.bankName || '');
      setPaymentPhone(firstPayment?.paymentPhone || '');
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
      if (match) setCustomer(prev => ({ ...prev, name: match.customerName || prev.name, address: match.customerAddress || prev.address }));
    }
  };

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
      const safeText = (text: any, x: number, y: number, options?: any) => doc.text(String(text || ""), n(x), n(y), options);

      // Header
      doc.setTextColor(0, 0, 0); doc.setFont(FONT, "bold"); doc.setFontSize(24);
      safeText(String(data.shop.name || 'SHOP NAME').toUpperCase(), PAGE_WIDTH / 2, 18, { align: 'center' });
      doc.setFontSize(9); doc.setFont(FONT, "normal");
      safeText(String(data.shop.address || ''), PAGE_WIDTH / 2, 23, { align: 'center' });
      doc.setFont(FONT, "bold");
      safeText(`Mobile : ${String(data.shop.phone || '')}`, PAGE_WIDTH / 2, 28, { align: 'center' });

      doc.setFontSize(14); doc.rect(n(PAGE_WIDTH / 2 - 25), 35, 50, 8);
      safeText("SALES INVOICE", PAGE_WIDTH / 2, 41, { align: 'center' });

      // Labels Left
      const metaY = 55; doc.setFontSize(10); doc.setFont(FONT, "bold");
      safeText("Customer", MARGIN, metaY); safeText("Address", MARGIN, metaY + 7); safeText("Mobile", MARGIN, metaY + 14); safeText("Attention", MARGIN, metaY + 21);
      doc.setFont(FONT, "bold"); safeText(`: ${invoice.customerName || 'Walking Customer'}`, MARGIN + 20, metaY);
      doc.setFont(FONT, "normal"); safeText(`: ${invoice.customerAddress || 'N/A'}`, MARGIN + 20, metaY + 7); safeText(`: ${invoice.customerPhone || 'N/A'}`, MARGIN + 20, metaY + 14); safeText(`: ${invoice.attention || ''}`, MARGIN + 20, metaY + 21);

      // Box Right (Invoice Info)
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

      // Table
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
      
      // Calculations Area
      doc.rect(n(MARGIN), n(fY + 5), 45, 8);
      doc.setFont(FONT, "bold"); doc.setFontSize(11); safeText(`TOTAL QTY : ${invoice.items.length}.00`, MARGIN + 4, fY + 10.5);
      
      const sX = PAGE_WIDTH - MARGIN - 70; const vX = PAGE_WIDTH - MARGIN;
      const calcRows = [["Total Amount", invoice.subtotal], ["Less Discount", invoice.discount], ["Net Payable", invoice.total], ["Received Amount", invoice.paidAmount], ["Current Due", invoice.dueAmount]];
      calcRows.forEach((r, i) => {
        const rowY = fY + 10 + (i * 7);
        if (i === 2) { doc.setFont(FONT, "bold"); doc.setFontSize(13); } else { doc.setFont(FONT, "normal"); doc.setFontSize(10); }
        safeText(String(r[0]), sX, rowY); safeText(formatAmount(r[1] as number), vX, rowY, { align: 'right' });
      });

      // Taka In Word (Wrapped to prevent overlap)
      doc.setFont(FONT, "bold"); doc.setFontSize(8); safeText("TAKA IN WORD", MARGIN, fY + 20);
      doc.setFont(FONT, "normal"); doc.setFontSize(10);
      const words = numberToWords(invoice.total);
      const splitWords = doc.splitTextToSize(words, sX - MARGIN - 5); 
      doc.text(splitWords, MARGIN, fY + 26);
      
      // Signature Section
      const sigY = PAGE_HEIGHT - 35; doc.line(n(MARGIN), n(sigY), n(MARGIN + 50), n(sigY)); doc.line(n(PAGE_WIDTH - MARGIN - 50), n(sigY), n(PAGE_WIDTH - MARGIN), n(sigY));
      doc.setFontSize(10); doc.setFont(FONT, "bold"); safeText("CUSTOMER SIGNATURE", MARGIN + 25, sigY + 5, { align: 'center' }); safeText("AUTHORIZED SIGNATURE", PAGE_WIDTH - MARGIN - 25, sigY + 5, { align: 'center' });
      
      // Footer Message
      doc.setFont(FONT, "bolditalic"); doc.setFontSize(11);
      doc.setTextColor(180, 180, 180); 
      safeText(`Thank you for your purchase, ${invoice.customerName || 'Customer'}!`, PAGE_WIDTH / 2, PAGE_HEIGHT - 12, { align: 'center' });
      
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

  const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal - discount;
  const dueAmount = Math.max(0, total - paidAmount);

  const handleFinalize = (shouldPrint: boolean = false) => {
    if (selectedItems.length === 0 || !customer.name || !customer.phone) return alert("Missing data.");
    const payment: PaymentDetails = { method: paymentMethod, transactionId: 'MZ-' + Date.now(), amount: paidAmount };
    if (paymentMethod === PaymentMethod.CARD) payment.bankName = bankName;
    else if ([PaymentMethod.BKASH, PaymentMethod.NAGAD, PaymentMethod.ROCKET].includes(paymentMethod)) payment.paymentPhone = paymentPhone;
    
    const shopInitials = data.shop.name.split(' ').map(w => w[0]).join('').toUpperCase() || 'HT';
    const invoice: Invoice = {
      id: editingInvoice ? editingInvoice.id : Math.random().toString(36).substr(2, 9),
      invoiceNumber: editingInvoice ? editingInvoice.invoiceNumber : `${shopInitials}${Date.now().toString().slice(-10)}`,
      date: editingInvoice ? editingInvoice.date : new Date().toISOString(),
      customerName: customer.name, customerPhone: customer.phone, customerAddress: customer.address, attention: customer.attention,
      items: selectedItems, subtotal, discount, vat: 0, total, payments: [payment], paidAmount, dueAmount
    };
    if (shouldPrint) generatePDF(invoice);
    onCreateInvoice(invoice);
    setIsConfirming(false);
  };

  const filteredAvailableStocks = data.stocks.filter(s => {
    const isAvailable = s.status === StockStatus.AVAILABLE;
    const isMatchingSearch = s.imei.includes(imeiInput);
    const isNotAlreadySelected = !selectedItems.some(item => item.imei === s.imei);
    return isAvailable && isMatchingSearch && isNotAlreadySelected;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{editingInvoice ? 'Edit Bill' : 'New Bill'}</h2>
        {editingInvoice && <button onClick={onCancelEdit} className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Discard</button>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl border shadow-sm">
            <h3 className="text-lg font-black mb-6 uppercase flex items-center"><span className="w-1.5 h-6 bg-blue-600 mr-3 rounded-full"></span>Buyer Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input type="tel" placeholder="Mobile Number *" className="w-full px-5 py-3 bg-slate-50 rounded-2xl outline-none font-bold border-2 border-transparent focus:border-blue-500 transition-all" value={customer.phone} onChange={e => handlePhoneChange(e.target.value)} />
              <input type="text" placeholder="Customer Name *" className="w-full px-5 py-3 bg-slate-50 rounded-2xl outline-none font-bold border-2 border-transparent focus:border-blue-500 transition-all" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
              <input type="text" placeholder="Address" className="w-full px-5 py-3 bg-slate-50 border rounded-2xl outline-none font-bold" value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} />
              <input type="text" placeholder="Attention" className="w-full px-5 py-3 bg-slate-50 border rounded-2xl outline-none font-bold" value={customer.attention} onChange={e => setCustomer({...customer, attention: e.target.value})} />
            </div>
          </div>
          <div className="bg-white p-8 rounded-3xl border shadow-sm">
            <h3 className="text-lg font-black mb-6 uppercase flex items-center"><span className="w-1.5 h-6 bg-blue-600 mr-3 rounded-full"></span>Item Entry</h3>
            <div className="flex space-x-3 mb-8 relative" ref={imeiDropdownRef}>
              <div className="flex-1 relative">
                <input type="text" placeholder="Scan or Search IMEI..." className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" value={imeiInput} onChange={e => { setImeiInput(e.target.value); setIsImeiDropdownOpen(true); }} onFocus={() => setIsImeiDropdownOpen(true)} onKeyDown={e => e.key === 'Enter' && handleAddIMEI()} />
                {isImeiDropdownOpen && (
                  <div className="absolute z-[60] left-0 right-0 top-full mt-2 bg-white border shadow-2xl rounded-2xl max-h-60 overflow-y-auto">
                    {filteredAvailableStocks.length > 0 ? filteredAvailableStocks.map(s => (
                      <button key={s.imei} type="button" className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex flex-col" onMouseDown={() => handleAddIMEI(s.imei)}>
                        <span className="font-black text-slate-900 text-xs">{s.imei}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{data.models.find(m => m.id === s.modelId)?.brand} {data.models.find(m => m.id === s.modelId)?.modelName}</span>
                      </button>
                    )) : <div className="p-4 text-center text-slate-400 text-xs">No IMEI found</div>}
                  </div>
                )}
              </div>
              <button onClick={() => handleAddIMEI()} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs">Add Item</button>
            </div>
            <table className="w-full text-left">
              <thead><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="p-4">Description</th><th className="p-4 text-right">Price</th><th className="p-4"></th></tr></thead>
              <tbody className="divide-y">
                {selectedItems.map(item => (
                  <tr key={item.imei}><td className="p-4"><p className="font-black text-slate-900 uppercase text-xs">{item.brand} {item.modelName}</p><p className="text-[10px] text-slate-400">IMEI: {item.imei}</p></td><td className="p-4 text-right font-black">{item.price.toLocaleString()}</td><td className="p-4 text-center"><button onClick={() => setSelectedItems(selectedItems.filter(i => i.imei !== item.imei))} className="text-rose-500 p-2"><Icons.Trash /></button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white h-fit space-y-6">
          <h3 className="text-lg font-black text-blue-400 uppercase">Billing Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between text-slate-400 font-bold text-xs uppercase"><span>Total Items</span><span>{selectedItems.length}.00</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400 font-bold text-xs uppercase">Discount</span><input type="number" className="w-24 p-2 bg-slate-800 rounded-xl text-right font-black text-white outline-none" value={discount || ''} onChange={e => setDiscount(Number(e.target.value))} /></div>
            <div className="pt-6 border-t border-slate-800 flex justify-between items-end"><span className="text-[10px] font-black text-blue-400 uppercase">Total Amount</span><span className="text-3xl font-black">{total.toLocaleString()}</span></div>
            <div className="mt-4">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Paid Amount</label>
              <input type="number" className="w-full p-4 bg-blue-600 rounded-2xl text-2xl font-black text-center outline-none ring-offset-2 focus:ring-4 ring-blue-500/50" value={paidAmount || ''} onChange={e => setPaidAmount(Number(e.target.value))} />
            </div>
            <div className="mt-4 space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Payment Method</label>
              <select className="w-full p-3 bg-slate-800 rounded-xl text-xs font-bold uppercase outline-none border border-transparent focus:border-blue-500" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {paymentMethod === PaymentMethod.CARD && (
                <input type="text" placeholder="Bank Name" className="w-full p-3 bg-slate-800 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-blue-500 animate-in slide-in-from-top-2" value={bankName} onChange={e => setBankName(e.target.value)} />
              )}
              {[PaymentMethod.BKASH, PaymentMethod.NAGAD, PaymentMethod.ROCKET].includes(paymentMethod) && (
                <input type="tel" placeholder={`${paymentMethod} Number/ID`} className="w-full p-3 bg-slate-800 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-blue-500 animate-in slide-in-from-top-2" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} />
              )}
            </div>
            <button onClick={() => setIsConfirming(true)} className="mt-8 w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-[2rem] uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Verify & Finalize</button>
          </div>
        </div>
      </div>
      {isConfirming && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-8 shadow-2xl animate-in zoom-in duration-200 text-center">
            <h3 className="text-2xl font-black text-slate-900 uppercase mb-4 tracking-tight">Confirm Invoice</h3>
            <div className="space-y-4 mb-8 text-left">
              <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-400 font-bold text-xs uppercase">Customer</span><span className="font-black text-slate-900 uppercase text-sm">{customer.name}</span></div>
              <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-400 font-bold text-xs uppercase">Total</span><span className="font-black text-slate-900 text-sm">{total.toLocaleString()}</span></div>
              <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-400 font-bold text-xs uppercase">Paid</span><span className="font-black text-emerald-600 text-sm">{paidAmount.toLocaleString()}</span></div>
              <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-400 font-bold text-xs uppercase">Due</span><span className="font-black text-rose-600 text-sm">{dueAmount.toLocaleString()}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsConfirming(false)} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-black uppercase text-xs tracking-widest">Cancel</button>
              <button onClick={() => handleFinalize(true)} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest">Print & Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCreator;
