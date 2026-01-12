import React, { useState } from 'react';

interface Props {
  onLogin: (shopName: string) => void;
}

const Auth: React.FC<Props> = ({ onLogin }) => {
  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper to treat shopName as an email for Firebase requirements
  const getShopEmail = (name: string) => {
    const sanitized = name.toLowerCase().replace(/\s/g, '');
    // If it's already an email, use it, otherwise append our internal domain
    return sanitized.includes('@') ? sanitized : `${sanitized}@mobil.com`;
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!shopName || !password) {
      setError('Required: Shop Name & Password.');
      setLoading(false);
      return;
    }

    try {
      // Firebase auth instance from global window (initialized in index.html)
      const auth = (window as any).auth;
      const { 
        signInWithEmailAndPassword, 
        createUserWithEmailAndPassword,
        updateProfile 
      } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

      if (mode === 'login') {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, getShopEmail(shopName), password);
          // displayName is set during registration to preserve the original shop name
          onLogin(userCredential.user.displayName || shopName);
        } catch (err: any) {
          if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            setError('Login Failed: Invalid credentials.');
          } else {
            setError(err.message || 'Authentication error occurred.');
          }
        }
      } else {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, getShopEmail(shopName), password);
          // Set business name as displayName so it works across devices
          await updateProfile(userCredential.user, { displayName: shopName });
          onLogin(shopName);
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use') {
            setError('Account Error: Business name already exists.');
          } else if (err.code === 'auth/weak-password') {
            setError('Security Error: Password must be 6+ characters.');
          } else {
            setError(err.message || 'Registration error occurred.');
          }
        }
      }
    } catch (err: any) {
      setError('System Error: Authentication service unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Basic guest entry without firebase sync
    onLogin('Guest Store');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-sans relative overflow-hidden">
      {/* Visual background enhancements */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-slate-900/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-slate-400/5 rounded-full blur-[120px]"></div>

      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.12)] p-12 relative z-10 border border-slate-100 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-4">POS</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em]">Inventory Sync v1.1</p>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[11px] font-black text-center animate-in shake uppercase tracking-tight">
            {error}
          </div>
        )}

        <form onSubmit={handleAction} className="space-y-8">
          <div className="space-y-5">
            <div className="group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Business Identity</label>
              <input
                type="text"
                placeholder="YOUR STORE NAME"
                className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-3xl outline-none transition-all font-black text-slate-900 uppercase tracking-tight text-sm placeholder:text-slate-200"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
              />
            </div>
            <div className="group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">System Key</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-3xl outline-none transition-all font-black text-slate-900 tracking-widest text-sm placeholder:text-slate-200"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-2xl hover:bg-black transition-all uppercase tracking-[0.3em] text-xs active:scale-[0.98] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Authorizing...' : (mode === 'login' ? 'Access Workspace' : 'Initialize Store')}
          </button>
        </form>

        <div className="mt-12 flex flex-col items-center space-y-6">
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-slate-900 font-black text-[10px] uppercase tracking-widest hover:opacity-70 transition-opacity"
          >
            {mode === 'login' ? "First Time? Create New Store" : "Existing Member? Sign In"}
          </button>

          <div className="w-full h-[1px] bg-slate-100 flex items-center justify-center">
            <span className="bg-white px-4 text-[8px] font-black text-slate-300 uppercase tracking-widest">Global Account Sync Enabled</span>
          </div>

          <button
            onClick={handleSkip}
            className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-blue-600 transition-colors py-2 px-6 rounded-xl border border-transparent hover:border-slate-100"
          >
            Local Guest Entry
          </button>
        </div>
      </div>
      
      <footer className="fixed bottom-10 text-center w-full pointer-events-none opacity-40">
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.6em]">Encrypted Cloud Protection</p>
      </footer>
    </div>
  );
};

export default Auth;