
import React, { useState } from 'react';
import { MobileModel } from '../types';
import { Icons } from '../constants';

interface Props {
  models: MobileModel[];
  onAdd: (model: MobileModel) => void;
  onUpdate: (model: MobileModel) => void;
  onDelete: (id: string) => void;
}

const ModelMaster: React.FC<Props> = ({ models, onAdd, onUpdate, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    modelName: '',
    purchasePrice: 0,
    sellingPrice: 0
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleOpenEdit = (model: MobileModel) => {
    setFormData({
      brand: model.brand,
      modelName: model.modelName,
      purchasePrice: model.purchasePrice,
      sellingPrice: model.sellingPrice
    });
    setEditingId(model.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearForm = () => {
    setEditingId(null);
    setFormData({ brand: '', modelName: '', purchasePrice: 0, sellingPrice: 0 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brand || !formData.modelName || formData.purchasePrice <= 0 || formData.sellingPrice <= 0) {
      alert("Please fill all details correctly.");
      return;
    }

    if (editingId) {
      onUpdate({
        id: editingId,
        ...formData
      });
    } else {
      const exists = models.find(m => 
        m.brand.toLowerCase() === formData.brand.toLowerCase() && 
        m.modelName.toLowerCase() === formData.modelName.toLowerCase()
      );

      if (exists) {
        alert("Model already exists in the catalog!");
        return;
      }

      onAdd({
        id: Math.random().toString(36).substr(2, 9),
        ...formData
      });
    }
    handleClearForm();
  };

  const confirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Catalog</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Manage your device portfolio</p>
        </div>
        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
          {models.length} Models Registered
        </div>
      </div>

      {/* Smart Compact Entry Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group transition-all hover:shadow-xl hover:shadow-slate-200/50">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="font-black text-slate-900 uppercase text-[9px] tracking-[0.3em] flex items-center">
            <span className={`w-1.5 h-3 rounded-full mr-2 ${editingId ? 'bg-amber-500 animate-pulse' : 'bg-slate-900'}`}></span>
            {editingId ? 'Modifying Product' : 'Quick Device Entry'}
          </h3>
          {editingId && (
            <button 
              type="button" 
              onClick={handleClearForm}
              className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 px-3 py-1 rounded-lg transition-colors"
            >
              Cancel Edit
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block px-1">Brand</label>
            <input
              type="text"
              placeholder="e.g. Apple"
              className="w-full px-4 py-3 bg-slate-50 border-transparent border-2 focus:border-slate-900 focus:bg-white rounded-xl outline-none transition-all font-bold text-[11px] placeholder:text-slate-200"
              value={formData.brand}
              onChange={e => setFormData({...formData, brand: e.target.value})}
            />
          </div>
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block px-1">Model Name</label>
            <input
              type="text"
              placeholder="e.g. iPhone 15"
              className="w-full px-4 py-3 bg-slate-50 border-transparent border-2 focus:border-slate-900 focus:bg-white rounded-xl outline-none transition-all font-bold text-[11px] placeholder:text-slate-200"
              value={formData.modelName}
              onChange={e => setFormData({...formData, modelName: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block px-1">Cost Price</label>
            <input
              type="number"
              placeholder="0"
              className="w-full px-4 py-3 bg-slate-50 border-transparent border-2 focus:border-slate-900 focus:bg-white rounded-xl outline-none transition-all font-black text-[11px] placeholder:text-slate-200"
              value={formData.purchasePrice || ''}
              onChange={e => setFormData({...formData, purchasePrice: Number(e.target.value)})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block px-1">Sale Price</label>
            <input
              type="number"
              placeholder="0"
              className="w-full px-4 py-3 bg-slate-50 border-transparent border-2 focus:border-slate-900 focus:bg-white rounded-xl outline-none transition-all font-black text-[11px] placeholder:text-slate-200"
              value={formData.sellingPrice || ''}
              onChange={e => setFormData({...formData, sellingPrice: Number(e.target.value)})}
            />
          </div>
          <div>
            <button 
              type="submit" 
              className={`w-full ${editingId ? 'bg-amber-600' : 'bg-slate-900'} text-white py-3.5 rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200 transition-all active:scale-[0.96] hover:bg-black text-[9px] flex items-center justify-center`}
            >
              {editingId ? <Icons.Settings /> : <Icons.Plus />}
              <span className="ml-2">{editingId ? 'UPDATE' : 'ADD MODEL'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Model List */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Device Specification</th>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Inward (Avg)</th>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Retail Target</th>
                <th className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {models.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-[0.4em]">Empty Catalog</td>
                </tr>
              ) : (
                models.slice().reverse().map(model => (
                  <tr key={model.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-black text-[10px]">
                          {model.brand[0]}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm uppercase tracking-tight leading-none mb-1">{model.brand} {model.modelName}</p>
                          <p className="text-slate-400 font-black text-[8px] uppercase tracking-widest">ID: {model.id.slice(0, 4)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-slate-400 text-xs">{(model.purchasePrice || 0).toLocaleString()}</td>
                    <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">{(model.sellingPrice || 0).toLocaleString()}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end items-center space-x-2">
                        <button 
                          onClick={() => handleOpenEdit(model)}
                          className="text-slate-200 hover:text-slate-900 transition-colors p-2 rounded-lg hover:bg-white"
                        >
                          <Icons.Settings />
                        </button>
                        <button 
                          onClick={() => setDeleteId(model.id)}
                          className="text-slate-200 hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-white"
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

      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-10 shadow-2xl border border-slate-100 animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 uppercase mb-4 tracking-tighter text-center">Remove Model?</h3>
            <p className="text-slate-400 text-[11px] text-center mb-8 font-bold uppercase tracking-widest leading-relaxed">
              Existing stock entries will persist but the template will be gone.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Yes, Remove</button>
              <button onClick={() => setDeleteId(null)} className="w-full bg-slate-50 text-slate-400 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Keep It</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelMaster;
