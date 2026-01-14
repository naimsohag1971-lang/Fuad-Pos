
import React, { useRef, useState, useEffect } from 'react';
import { AppData, ShopAccount } from '../types';

interface Props {
  data: AppData;
  onUpdateShop: (shop: ShopAccount) => void;
  onRestore: (data: AppData) => void;
  onResetAll: () => void;
}

const Settings: React.FC<Props> = ({ data, onUpdateShop, onRestore, onResetAll }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>(data.shop.logoUrl);
  
  // Account Security States
  const [displayUsername, setDisplayUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);
  const [isResetConfirming, setIsResetConfirming] = useState(false);

  // Extract plain username from Firebase email on mount
  useEffect(() => {
    const auth = (window as any).auth;
    if (auth?.currentUser?.email) {
      const username = auth.currentUser.email.split('@')[0];
      setDisplayUsername(username);
      setNewUsername(username);
    }
  }, []);

  const handleUpdateProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updatedShop: ShopAccount = {
      ...data.shop,
      name: (formData.get('shopName') as string).trim(),
      address: (formData.get('address') as string).trim(),
      phone: (formData.get('phone') as string).trim(),
      email: (formData.get('email') as string).trim() || undefined,
      preparedBy: (formData.get('preparedBy') as string).trim(),
      inactivityTimeout: Number(formData.get('inactivityTimeout')) || 30,
      logoUrl: logoPreview || undefined
    };
    onUpdateShop(updatedShop);
    alert("System Settings Updated Successfully.");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSecurityUpdate = async () => {
    const cleanNewUsername = newUsername.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const rawNewPassword = newPassword;
    const rawCurrentPassword = currentPassword;

    if (!rawCurrentPassword) {
      alert("Current Password is Required to confirm security changes.");
      return;
    }

    if (!cleanNewUsername) {
      alert("Login ID cannot be empty.");
      return;
    }

    const isUsernameChanged = cleanNewUsername !== displayUsername;
    const isPasswordChanged = rawNewPassword.length > 0;

    if (!isUsernameChanged && !isPasswordChanged) {
      alert("No changes detected in Login ID or Password.");
      return;
    }

    setIsUpdatingSecurity(true);

    try {
      const auth = (window as any).auth;
      let user = auth.currentUser;
      if (!user) throw new Error("Session expired. Please log in again.");

      const { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

      const credential = EmailAuthProvider.credential(user.email, rawCurrentPassword);
      let userCredential;
      try {
        userCredential = await reauthenticateWithCredential(user, credential);
      } catch (authErr: any) {
        if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
          throw new Error("Incorrect current password. Please try again.");
        }
        throw authErr;
      }

      const freshUser = userCredential.user;

      if (isUsernameChanged) {
        try {
          const pseudoEmail = `${cleanNewUsername}@mobil.com`;
          await updateEmail(freshUser, pseudoEmail);
          setDisplayUsername(cleanNewUsername);
        } catch (emailErr: any) {
          if (emailErr.code === 'auth/email-already-in-use') {
            throw new Error("This login ID is already in use. Please choose another.");
          }
          throw emailErr;
        }
      }

      if (isPasswordChanged) {
        if (rawNewPassword.length < 6) throw new Error("New password must be at least 6 characters.");
        await updatePassword(freshUser, rawNewPassword);
      }

      alert("Security update successful.");
      setCurrentPassword('');
      setNewPassword('');

    } catch (err: any) {
      alert(err.message || "An error occurred during security update.");
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-24 animate-in fade-in duration-500">
      <header className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">System Configuration</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Manage core identity and data</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Business Settings */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="font-black mb-10 text-slate-900 uppercase tracking-widest text-[11px] flex items-center">
              <span className="w-2 h-5 bg-blue-600 mr-3 rounded-full"></span>
              Business Identity
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-8">
              <div className="flex flex-col items-center">
                <div 
                  onClick={() => logoInputRef.current?.click()} 
                  className="w-24 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-blue-500 transition-colors"
                >
                  {logoPreview ? (
                    <img src={logoPreview} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="text-center">
                      <div className="text-slate-300 mb-1"><svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                      <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest">Logo</span>
                    </div>
                  )}
                </div>
                <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Shop Name</label>
                   <input name="shopName" defaultValue={data.shop.name} className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Primary Phone</label>
                   <input name="phone" defaultValue={data.shop.phone} className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                   <input name="email" defaultValue={data.shop.email || ''} type="email" placeholder="shop@example.com" className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Authorized Operator</label>
                   <input name="preparedBy" defaultValue={data.shop.preparedBy} className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Store Address</label>
                   <textarea name="address" defaultValue={data.shop.address} rows={2} className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all resize-none" />
                 </div>
              </div>
              
              <input type="hidden" name="inactivityTimeout" value={data.shop.inactivityTimeout || 30} />
              
              <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] uppercase text-[11px] tracking-[0.3em] shadow-xl hover:bg-black active:scale-[0.98] transition-all">Save Business Profile</button>
            </form>
          </div>

          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="font-black mb-10 text-slate-900 uppercase tracking-widest text-[11px] flex items-center">
              <span className="w-2 h-5 bg-amber-500 mr-3 rounded-full"></span>
              Login Timeout
            </h3>
            <div className="space-y-4">
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Configure auto-logout duration for inactive sessions</p>
               <div className="flex items-center gap-4">
                 <input 
                  type="number" 
                  className="w-24 px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl outline-none font-black text-sm transition-all"
                  defaultValue={data.shop.inactivityTimeout || 30}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (val > 0) {
                      onUpdateShop({ ...data.shop, inactivityTimeout: val });
                    }
                  }}
                 />
                 <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Minutes</span>
               </div>
               <p className="text-[9px] text-slate-300 font-bold italic">The session will automatically expire if no user interaction is detected for the specified time.</p>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-[11px] mb-1">Database Portability</h3>
              <p className="text-[10px] text-slate-400 font-bold">Export records for offline auditing</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { const b = new Blob([JSON.stringify(data)], {type:'application/json'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=`MOBIL_BACKUP_${new Date().toISOString().slice(0,10)}.json`; a.click(); }} className="px-6 py-3 bg-slate-50 text-slate-900 rounded-xl font-black text-[9px] uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all">Export JSON</button>
              <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-slate-50 text-slate-900 rounded-xl font-black text-[9px] uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all">Import File</button>
              <input type="file" ref={fileInputRef} onChange={(e) => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=(ev)=>{ try{ const d=JSON.parse(ev.target?.result as string); onRestore(d); alert("Database Resynchronized."); }catch(err){alert("Invalid file structure.");}}; r.readAsText(f); }} className="hidden" accept=".json" />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white">
            <h3 className="font-black mb-8 text-blue-400 uppercase tracking-widest text-[11px] flex justify-between items-center">
              Account Security
              <span className="text-slate-600 font-mono text-[9px] lowercase tracking-normal bg-slate-800 px-3 py-1 rounded-full">{displayUsername}</span>
            </h3>

            <div className="space-y-6">
               <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-500 uppercase block tracking-widest px-1">Login ID</label>
                 <input 
                   type="text" 
                   autoComplete="off"
                   className="w-full bg-slate-800 border-2 border-transparent focus:border-blue-500 outline-none p-5 rounded-2xl font-black text-white text-sm transition-all" 
                   value={newUsername} 
                   onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} 
                 />
               </div>

               <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-500 uppercase block tracking-widest px-1">New Password</label>
                 <input 
                   type="password" 
                   autoComplete="new-password"
                   placeholder="Keep empty to skip" 
                   className="w-full bg-slate-800 border-2 border-transparent focus:border-blue-500 outline-none p-5 rounded-2xl font-black text-white text-sm transition-all tracking-[0.3em] placeholder:tracking-normal placeholder:font-bold" 
                   value={newPassword} 
                   onChange={e => setNewPassword(e.target.value)} 
                 />
               </div>

               <div className="pt-6 border-t border-slate-800 space-y-2">
                 <label className="text-[9px] font-black text-rose-500 uppercase block tracking-[0.2em] px-1">Verify Current Password *</label>
                 <input 
                   type="password" 
                   autoComplete="current-password"
                   placeholder="Authorize Change" 
                   className="w-full bg-slate-800 border-2 border-rose-500/30 focus:border-rose-500 outline-none p-5 rounded-2xl font-black text-white text-sm transition-all tracking-[0.3em] placeholder:tracking-normal placeholder:font-bold" 
                   value={currentPassword} 
                   onChange={e => setCurrentPassword(e.target.value)} 
                 />
               </div>

               <button 
                onClick={handleSecurityUpdate} 
                disabled={isUpdatingSecurity} 
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
               >
                 {isUpdatingSecurity ? 'Verifying...' : 'Update Security'}
               </button>
            </div>
          </div>

          <div className="bg-rose-50 p-10 rounded-[3rem] border border-rose-100">
             <h3 className="text-rose-600 font-black text-[11px] uppercase tracking-widest mb-2">Emergency Reset</h3>
             <p className="text-rose-400 text-[10px] font-bold leading-relaxed mb-6">Wipe all local and cloud data permanently.</p>
             <button onClick={() => setIsResetConfirming(true)} className="w-full bg-white text-rose-600 border border-rose-200 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">Factory Reset</button>
          </div>
        </div>
      </div>

      {isResetConfirming && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] max-w-md w-full p-12 shadow-2xl text-center animate-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">Total Wipeout?</h3>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">This cannot be undone.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { onResetAll(); setIsResetConfirming(false); }} className="w-full bg-rose-600 text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl">Yes, Purge Data</button>
              <button onClick={() => setIsResetConfirming(false)} className="w-full bg-slate-100 text-slate-500 py-4 rounded-[2rem] font-black uppercase text-xs tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
