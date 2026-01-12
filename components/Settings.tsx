
import React, { useRef, useState, useEffect } from 'react';
import { AppData, ShopAccount } from '../types';

declare const google: any;

interface Props {
  data: AppData;
  onUpdateShop: (shop: ShopAccount) => void;
  onRestore: (data: AppData) => void;
  onResetAll: () => void;
}

const BACKUP_FILE_NAME = 'mobil_backup.json';

const Settings: React.FC<Props> = ({ data, onUpdateShop, onRestore, onResetAll }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>(data.shop.logoUrl);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'bn'>(data.shop.language || 'en');
  const [isResetConfirming, setIsResetConfirming] = useState(false);

  // Drive Sync States
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGisLoaded, setIsGisLoaded] = useState(false);
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(localStorage.getItem('last_drive_sync'));

  useEffect(() => {
    const checkGis = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        setIsGisLoaded(true);
        clearInterval(checkGis);
      }
    }, 500);
    return () => clearInterval(checkGis);
  }, []);

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updatedShop: ShopAccount = {
      ...data.shop,
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      preparedBy: formData.get('preparedBy') as string,
      language: selectedLanguage,
      logoUrl: logoPreview
    };
    onUpdateShop(updatedShop);
    alert("Profile saved successfully!");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBackup = () => {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mobil_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const restoredData = JSON.parse(event.target?.result as string);
        if (confirm("Restore this local file? Current data will be lost.")) {
          onRestore(restoredData);
          setLogoPreview(restoredData.shop.logoUrl);
          setSelectedLanguage(restoredData.shop.language);
          alert("Restore successful!");
        }
      } catch (err) {
        alert("Invalid file format.");
      }
    };
    reader.readAsText(file);
  };

  const connectDrive = () => {
    if (!isGisLoaded) {
      alert("Google Services loading...");
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: '1091564619736-v3jrtm0v63c8p2v1l1m9b8c0o3h8a2f4.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response: any) => {
        if (response.access_token) {
          setDriveToken(response.access_token);
          alert("Connected to Cloud Storage!");
        }
      },
    });
    client.requestAccessToken();
  };

  const handleCloudBackup = async () => {
    if (!driveToken) return connectDrive();
    setIsSyncing(true);
    try {
      const content = JSON.stringify(data);
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}'&spaces=drive`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      const searchData = await searchRes.json();
      let fileId = searchData.files?.[0]?.id;

      if (!fileId) {
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: BACKUP_FILE_NAME, mimeType: 'application/json' })
        });
        const createData = await createRes.json();
        fileId = createData.id;
      }

      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
        body: content
      });

      const now = new Date().toLocaleString();
      setLastCloudSync(now);
      localStorage.setItem('last_drive_sync', now);
      alert("Cloud Sync Successful!");
    } catch (e) {
      alert("Sync error.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudRestore = async () => {
    if (!driveToken) return connectDrive();
    setIsSyncing(true);
    try {
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}'&spaces=drive`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      const searchData = await searchRes.json();
      const fileId = searchData.files?.[0]?.id;

      if (!fileId) {
        alert("No cloud backup found.");
        return;
      }

      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      const restoredData = await fileRes.json();
      
      if (confirm("Restore this cloud file? Current local data will be lost.")) {
        onRestore(restoredData);
        setLogoPreview(restoredData.shop.logoUrl);
        setSelectedLanguage(restoredData.shop.language);
        alert("Cloud Restore Successful!");
      }
    } catch (e) {
      alert("Cloud restore error.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 animate-in fade-in duration-500 relative">
      <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Settings & Business Profile</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Profile Settings */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 h-fit">
          <h3 className="font-black mb-8 text-slate-900 uppercase tracking-widest text-xs flex items-center">
            <span className="w-1.5 h-4 bg-blue-600 mr-2 rounded-full"></span>
            Shop Branding
          </h3>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="flex flex-col items-center mb-6">
              <div 
                onClick={() => logoInputRef.current?.click()}
                className="w-24 h-24 bg-slate-100 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-all overflow-hidden group relative"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    <span className="text-[8px] font-black uppercase">Upload Logo</span>
                  </div>
                )}
              </div>
              <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
            </div>

            <div className="space-y-4">
               <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedLanguage('en')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase ${selectedLanguage === 'en' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>English</button>
                  <button type="button" onClick={() => setSelectedLanguage('bn')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase ${selectedLanguage === 'bn' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>বাংলা</button>
               </div>
               <input name="name" defaultValue={data.shop.name} placeholder="Shop Name" className="w-full px-5 py-3 bg-slate-50 border rounded-2xl outline-none font-bold" />
               <input name="preparedBy" defaultValue={data.shop.preparedBy} placeholder="Operator Name" className="w-full px-5 py-3 bg-slate-50 border rounded-2xl outline-none font-bold" />
               <textarea name="address" defaultValue={data.shop.address} placeholder="Store Address" className="w-full px-5 py-3 bg-slate-50 border rounded-2xl outline-none font-bold" rows={2} />
               <input name="phone" defaultValue={data.shop.phone} placeholder="Shop Contact" className="w-full px-5 py-3 bg-slate-50 border rounded-2xl outline-none font-bold" />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all">Update Profile</button>
          </form>
        </div>

        {/* Cloud & Operations */}
        <div className="space-y-8">
          <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl text-white relative overflow-hidden">
            <h3 className="font-black mb-2 text-xs uppercase tracking-widest text-blue-400">Google Drive Sync</h3>
            <div className="space-y-4 relative z-10">
              {!driveToken ? (
                <button onClick={connectDrive} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all ${isGisLoaded ? 'bg-white text-slate-900' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                  Connect Cloud
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button disabled={isSyncing} onClick={handleCloudBackup} className="bg-blue-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest">
                    {isSyncing ? 'Syncing...' : 'Backup'}
                  </button>
                  <button disabled={isSyncing} onClick={handleCloudRestore} className="bg-slate-800 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest">Restore</button>
                </div>
              )}
              {lastCloudSync && <p className="text-center text-[8px] font-black text-slate-500 uppercase tracking-widest">Last Sync: {lastCloudSync}</p>}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <h3 className="font-black mb-6 text-slate-900 uppercase tracking-widest text-xs">System Operations</h3>
            <div className="flex flex-col space-y-3">
              <button onClick={handleBackup} className="w-full bg-slate-50 text-slate-700 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all">Download Backup</button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-slate-50 text-slate-700 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all">Restore Backup</button>
              <input type="file" ref={fileInputRef} onChange={handleRestore} className="hidden" accept=".json" />
              <button onClick={() => setIsResetConfirming(true)} className="w-full bg-rose-50 text-rose-600 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-colors">Wipe All Data</button>
            </div>
          </div>
        </div>
      </div>

      {isResetConfirming && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border-4 border-rose-500 animate-in zoom-in duration-200 text-center">
            <h3 className="text-2xl font-black text-slate-900 uppercase mb-4">Total Wipeout?</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium">This deletes everything. Records, stocks, invoices, everything. Use backup first!</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { onResetAll(); setIsResetConfirming(false); }} className="w-full bg-rose-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Confirm Wipe</button>
              <button onClick={() => setIsResetConfirming(false)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
