
import React, { useState, useRef, useEffect } from 'react';
import { AppData, Purchase, PurchaseItem, MobileModel, Supplier } from '../types';
import { Icons } from '../constants';

interface Props {
  data: AppData;
  onCreatePurchase: (purchase: Purchase) => void;
}

const PurchaseManager: React.FC<Props> = ({ data, onCreatePurchase }) => {
  const [supplier, setSupplier] = useState({ name: '', phone: '', address: '' });
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState<MobileModel | null>(null);
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [imeisInput, setImeisInput] = useState('');
  const [discount, setDiscount] = useState(0);
  const [vatPercent, setVatPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = data.models.filter(m => 
    `${m.brand} ${m.modelName}`.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const filteredSuppliers = (data.suppliers || []).filter(s => 
    s.name.toLowerCase().includes(supplier.name.toLowerCase())
  );

  const handleSupplierSelect = (s: Supplier) => {
    setSupplier({
      name: s.name,
      phone: s.phone,
      address: s.address || ''
    });
    setIsSupplierDropdownOpen(false);
  };

  const addItem = () => {
    if (!selectedModel || !imeisInput.trim()) {
      alert("Please select a model and enter IMEIs.");
      return;
    }

    const inputImeis = imeisInput
      .split(/[\n,]/)
      .map(i => i.trim())
      .filter(i => i.length > 0);

    if (inputImeis.length === 0) return;

    const existingInDb = new Set(data.stocks.map(s => s.imei));
    const existingInQueue = new Set(items.flatMap(item => item.imeis));

    const duplicates: string[] = [];
    const uniqueToThisEntry: string[] = [];
    const selfDuplicatesInEntry = new Set<string>();

    inputImeis.forEach(imei => {
      if (existingInDb.has(imei) || existingInQueue.has(imei) || selfDuplicatesInEntry.has(imei)) {
        duplicates.push(imei);
      } else {
        uniqueToThisEntry.push(imei);
        selfDuplicatesInEntry.add(imei);
      }
    });

    if (duplicates.length > 0) {
      alert(`DUPLICATE IMEI WARNING!\n\nThe following IMEIs are already in the system or current list and will be skipped:\n\n${duplicates.join(', ')}`);
    }

    if (uniqueToThisEntry.length === 0) {
      setImeisInput('');
      return;
    }

    const newItem: PurchaseItem = {
      modelId: selectedModel.id,
      brand: selectedModel.brand,
      modelName: selectedModel.modelName,
      imeis: uniqueToThisEntry,
      costPrice: costPrice || selectedModel.purchasePrice,
      sellingPrice: sellingPrice || selectedModel.sellingPrice
    };

    setItems([...items, newItem]);
    resetItemEntry();
  };

  const resetItemEntry = () => {
    setSelectedModel(null);
    setModelSearch('');
    setCostPrice(0);
    setSellingPrice(0);
    setImeisInput('');
  };

  // --- Bulk Purchase Excel Logic ---
  const downloadTemplate = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return alert("System library not loaded yet.");
    
    const templateData = [
      { 
        "Supplier": "M/S Mobile World", 
        "Phone": "01700000000", 
        "Brand": "Apple", 
        "Model": "iPhone 15 Pro", 
        "Cost Price": 120000, 
        "Sale Price": 135000, 
        "IMEIs": "358900001, 358900002" 
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase_Template");
    XLSX.writeFile(wb, "Mobil_Purchase_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const XLSX = (window as any).XLSX;
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const dataRows = XLSX.utils.sheet_to_json(ws);
        
        let localItems: PurchaseItem[] = [...items];
        let firstSupplier = { name: '', phone: '', address: '' };

        dataRows.forEach((row: any, idx: number) => {
          const sName = String(row['Supplier'] || '').trim();
          const sPhone = String(row['Phone'] || '').trim();
          const brand = String(row['Brand'] || '').trim();
          const modelName = String(row['Model'] || '').trim();
          const cost = Number(row['Cost Price'] || 0);
          const sale = Number(row['Sale Price'] || 0);
          const rawImeis = String(row['IMEIs'] || '');

          if (idx === 0 && sName) {
            firstSupplier = { name: sName, phone: sPhone, address: '' };
          }

          const modelMatch = data.models.find(m => 
            m.brand.toLowerCase() === brand.toLowerCase() && 
            m.modelName.toLowerCase() === modelName.toLowerCase()
          );

          const inputImeis = rawImeis.split(/[,|\n]/).map(i => i.trim()).filter(i => i.length > 0);

          if (modelMatch && inputImeis.length > 0) {
            localItems.push({
              modelId: modelMatch.id,
              brand: modelMatch.brand,
              modelName: modelMatch.modelName,
              imeis: inputImeis,
              costPrice: cost,
              sellingPrice: sale
            });
          }
        });

        if (firstSupplier.name) setSupplier(firstSupplier);
        setItems(localItems);
        alert("Excel Import Complete! Items added to the queue below.");
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        alert("Error reading Excel. Please use the downloaded template.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const subtotal = items.reduce((sum, item) => sum + (item.costPrice * item.imeis.length), 0);
  const vatAmount = (subtotal * vatPercent) / 100;
  const total = subtotal + vatAmount - discount;
  const dueAmount = total - paidAmount;

  const handleCreate = () => {
    if (items.length === 0 || !supplier.name.trim()) {
      alert("Missing required data: Supplier Name is required.");
      return;
    }

    const purchase: Purchase = {
      id: Math.random().toString(36).substr(2, 9),
      purchaseNumber: `PUR-${Date.now().toString().slice(-8)}`,
      date: new Date().toISOString(),
      supplierName: supplier.name,
      supplierPhone: supplier.phone,
      supplierAddress: supplier.address,
      items,
      subtotal,
      vat: vatAmount,
      discount,
      total,
      paidAmount,
      dueAmount
    };

    onCreatePurchase(purchase);
    setSupplier({ name: '', phone: '', address: '' });
    setItems([]);
    alert("Purchase recorded and stock updated!");
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Purchase Entry</h2>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Formal Stock Inwarding Module</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={downloadTemplate}
            className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-2.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-all flex items-center"
          >
            <svg className="w-3.5 h-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download Template
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center"
          >
            <svg className="w-3.5 h-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Upload Excel Data
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-6 flex items-center">
              <span className="w-1.5 h-4 bg-slate-900 rounded-full mr-3"></span>
              Supplier Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative" ref={supplierDropdownRef}>
                <input 
                  type="text" 
                  placeholder="Type to search or add supplier *" 
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-[11px] transition-all"
                  value={supplier.name}
                  onChange={e => { setSupplier({...supplier, name: e.target.value}); setIsSupplierDropdownOpen(true); }}
                  onFocus={() => setIsSupplierDropdownOpen(true)}
                />
                {isSupplierDropdownOpen && filteredSuppliers.length > 0 && (
                  <div className="absolute z-[60] left-0 right-0 top-full mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl max-h-48 overflow-y-auto">
                    {filteredSuppliers.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex flex-col group"
                        onClick={() => handleSupplierSelect(s)}
                      >
                        <span className="font-bold text-slate-900 text-[10px] uppercase">{s.name}</span>
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{s.phone || 'No phone record'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input 
                type="text" 
                placeholder="Phone Number" 
                className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-[11px] transition-all"
                value={supplier.phone}
                onChange={e => setSupplier({...supplier, phone: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Business Address" 
                className="px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-[11px] transition-all md:col-span-2"
                value={supplier.address}
                onChange={e => setSupplier({...supplier, address: e.target.value})}
              />
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 mb-6 flex items-center">
              <span className="w-1.5 h-4 bg-slate-900 rounded-full mr-3"></span>
              Add Products
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3" ref={modelDropdownRef}>
                <div className="md:col-span-6 relative">
                  <input 
                    type="text" 
                    placeholder="Find model to add..." 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-bold text-[11px] transition-all"
                    value={modelSearch}
                    onChange={e => { setModelSearch(e.target.value); setIsModelDropdownOpen(true); }}
                    onFocus={() => setIsModelDropdownOpen(true)}
                  />
                  {isModelDropdownOpen && filteredModels.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl max-h-48 overflow-y-auto overflow-x-hidden">
                      {filteredModels.map(m => (
                        <button
                          key={m.id}
                          className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex flex-col group"
                          onClick={() => {
                            setSelectedModel(m);
                            setModelSearch(`${m.brand} ${m.modelName}`);
                            setIsModelDropdownOpen(false);
                            setCostPrice(m.purchasePrice);
                            setSellingPrice(m.sellingPrice);
                          }}
                        >
                          <span className="font-bold text-slate-900 text-[10px] uppercase">{m.brand} {m.modelName}</span>
                          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Base Cost: {m.purchasePrice}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-3">
                  <input 
                    type="number" 
                    placeholder="COST PRICE" 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-black text-[11px] transition-all"
                    value={costPrice || ''}
                    onChange={e => setCostPrice(Number(e.target.value))}
                  />
                </div>
                <div className="md:col-span-3">
                   <input 
                    type="number" 
                    placeholder="RETAIL PRICE" 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-black text-[11px] transition-all"
                    value={sellingPrice || ''}
                    onChange={e => setSellingPrice(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="relative">
                <textarea 
                  placeholder="Paste IMEIs here (one per line)..." 
                  rows={4}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none font-mono text-xs transition-all resize-none"
                  value={imeisInput}
                  onChange={e => setImeisInput(e.target.value)}
                />
              </div>

              <button 
                onClick={addItem}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-[0.98] transition-all shadow-xl shadow-slate-200"
              >
                + STAGE FOR PURCHASE
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50">
               <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Purchase Queue</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Item Model</th>
                    <th className="px-6 py-4">Serial Numbers (IMEIs)</th>
                    <th className="px-6 py-4 text-center">Qty</th>
                    <th className="px-6 py-4 text-right">Unit Cost</th>
                    <th className="px-6 py-4 text-right">Subtotal</th>
                    <th className="px-6 py-4 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-300 font-black uppercase tracking-widest">Add products above to build invoice</td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4">
                           <p className="font-black text-slate-900 uppercase">{item.brand} {item.modelName}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500 uppercase">
                          {item.imeis.length > 2 ? `${item.imeis[0]}, ${item.imeis[1]} (+${item.imeis.length - 2} more)` : item.imeis.join(', ')}
                        </td>
                        <td className="px-6 py-4 text-center font-black">{item.imeis.length}</td>
                        <td className="px-6 py-4 text-right font-black">{item.costPrice.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black">{(item.costPrice * item.imeis.length).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => removeItem(idx)} className="text-rose-500 hover:scale-125 transition-transform"><Icons.Trash /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white h-fit sticky top-6 space-y-8 border border-slate-800">
           <div className="space-y-1">
             <h3 className="text-lg font-black tracking-tighter uppercase leading-tight">Financial Summary</h3>
             <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">Supplier Settlement</p>
           </div>

           <div className="space-y-4">
              <div className="flex justify-between items-center text-[11px] font-black uppercase text-slate-400">
                <span>Gross Purchase</span>
                <span className="text-white">{subtotal.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center text-[11px] font-black uppercase">
                <span className="text-slate-400">Less Discount</span>
                <input 
                  type="number" 
                  className="bg-slate-800 border-none outline-none p-2 rounded-xl text-right font-black text-white w-24 text-[11px]"
                  value={discount || ''}
                  onChange={e => setDiscount(Number(e.target.value))}
                />
              </div>

              <div className="pt-6 border-t border-slate-800 flex justify-between items-end">
                <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Final Payable</p>
                  <p className="text-4xl font-black text-white tracking-tighter">{total.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-500/20 space-y-4 mt-8">
                <div>
                  <label className="text-[9px] font-black text-blue-400 uppercase block mb-2 tracking-widest">Amount Paid to Supplier</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full bg-transparent border-b-2 border-blue-500 font-black text-2xl outline-none p-0 pb-1 text-white placeholder:text-blue-900/50"
                    value={paidAmount || ''}
                    onChange={e => setPaidAmount(Number(e.target.value))}
                  />
                </div>
                
                <div className="flex justify-between items-center">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Supplier Due</p>
                   <p className={`text-sm font-black uppercase ${dueAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                     {dueAmount > 0 ? `BDT ${dueAmount.toLocaleString()}` : 'FULLY SETTLED'}
                   </p>
                </div>
              </div>
           </div>

           <button 
            disabled={items.length === 0}
            onClick={handleCreate}
            className="w-full bg-white text-slate-900 py-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl hover:bg-slate-100 transition-all active:scale-[0.97] disabled:opacity-20 disabled:scale-100"
           >
             VERIFY & RECORD PURCHASE
           </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseManager;
