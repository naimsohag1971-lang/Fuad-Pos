
import React, { useState } from 'react';

interface Props {
  onLogin: (uid: string, username: string) => void;
}

const Auth: React.FC<Props> = ({ onLogin }) => {
  const [loginPrefix, setLoginPrefix] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanUsername = loginPrefix.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const rawPassword = password; 

    if (!cleanUsername || !rawPassword) {
      setError('Required: Please enter Login ID and Password.');
      return;
    }

    setLoading(true);

    try {
      const auth = (window as any).auth;
      const { 
        signInWithEmailAndPassword, 
        createUserWithEmailAndPassword
      } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

      // Appends pseudo-domain for Firebase compatibility
      const targetEmail = `${cleanUsername}@mobil.com`;

      if (mode === 'login') {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, targetEmail, rawPassword);
          onLogin(userCredential.user.uid, cleanUsername);
        } catch (err: any) {
          console.error("Auth Failure:", err.code);
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
            setError('Access Denied: Incorrect Login ID or Password.');
          } else if (err.code === 'auth/too-many-requests') {
            setError('System: Too many failed attempts. Try again later.');
          } else {
            setError(`Error: ${err.message}`);
          }
        }
      } else {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, rawPassword);
          onLogin(userCredential.user.uid, cleanUsername);
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use') {
            setError('Registration: This login ID is already registered.');
          } else if (err.code === 'auth/weak-password') {
            setError('Security: Password must be at least 6 characters.');
          } else {
            setError(err.message || 'Registration failed.');
          }
        }
      }
    } catch (err: any) {
      setError('Connection: Auth service temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onLogin('local_guest_session', 'guest');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 font-sans relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-slate-900/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-slate-400/5 rounded-full blur-[120px]"></div>

      <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.12)] p-12 relative z-10 border border-slate-100 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-3">Smart POS</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em]">Enterprise Desktop Suite</p>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black text-center uppercase tracking-tight">
            {error}
          </div>
        )}

        <form onSubmit={handleAction} className="space-y-6">
          <div className="group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Login ID (Username)</label>
            <input
              type="text"
              autoComplete="off"
              spellCheck="false"
              placeholder="ENTER SYSTEM ID"
              className="w-full px-7 py-5 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none transition-all font-black text-slate-900 text-sm uppercase tracking-widest"
              value={loginPrefix}
              onChange={e => setLoginPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            />
          </div>
          
          <div className="group">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">System Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-7 py-5 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none transition-all font-black text-slate-900 tracking-[0.4em] text-sm"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white font-black py-6 rounded-[2.5rem] shadow-2xl hover:bg-black transition-all uppercase tracking-[0.4em] text-xs active:scale-[0.98] disabled:opacity-50 mt-4"
          >
            {loading ? 'Authorizing...' : (mode === 'login' ? 'Enter System' : 'Create Account')}
          </button>
        </form>

        <div className="mt-12 flex flex-col items-center space-y-5">
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-slate-900 font-black text-[10px] uppercase tracking-widest hover:opacity-70 transition-opacity"
          >
            {mode === 'login' ? "Account Required? Register Here" : "Have an Account? Login"}
          </button>
          <div className="w-full h-[1px] bg-slate-100"></div>
          <button
            onClick={handleSkip}
            className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-blue-600 transition-colors"
          >
            Offline Demo Mode
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
