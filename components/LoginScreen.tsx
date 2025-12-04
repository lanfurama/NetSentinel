
import React, { useState } from 'react';
import { ShieldCheck, UserCircle, Lock, ChevronRight, Fingerprint, Activity, MonitorPlay, Key, LockKeyhole } from './Icons';
import { User } from '../types';
import apiService from '../services/apiService';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'kiosk'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [kioskPin, setKioskPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        // Call API for regular login
        const response = await apiService.login(username, password);
        if (response.success && response.data) {
          onLogin({
            username: response.data.username,
            fullName: response.data.fullName,
            role: response.data.role
          });
        }
      } else {
        // Call API for kiosk login
        const response = await apiService.kioskLogin(kioskPin);
        if (response.success && response.data) {
          onLogin({
            username: response.data.username,
            fullName: response.data.fullName,
            role: 'kiosk'
          });
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Authentication failed. Please try again.';
      setError(errorMessage);
      setLoading(false);
      if (mode === 'kiosk') {
        setKioskPin('');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 animate-fade-in">
        <div className="p-8 pb-6 border-b border-slate-800 bg-slate-900/50">
           <div className="flex justify-center mb-6">
             <div className={`w-16 h-16 rounded-xl flex items-center justify-center border shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all ${mode === 'login' ? 'bg-blue-600/20 border-blue-500/30' : 'bg-indigo-600/20 border-indigo-500/30'}`}>
               {mode === 'login' ? <Activity className="w-8 h-8 text-blue-400" /> : <MonitorPlay className="w-8 h-8 text-indigo-400" />}
             </div>
           </div>
           <h2 className="text-2xl font-bold text-center text-white mb-1">NetSentinel</h2>
           <p className="text-center text-slate-400 text-sm">
             {mode === 'login' ? 'Secure Network Monitoring System' : 'Live Kiosk Display Mode'}
           </p>
        </div>

        {/* Toggle Bar */}
        <div className="flex p-2 bg-slate-950/50 border-b border-slate-800">
          <button 
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Admin Login
          </button>
          <button 
            onClick={() => { setMode('kiosk'); setError(''); }}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'kiosk' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Kiosk Mode
          </button>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-5">
           {error && (
             <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-xs text-center font-medium animate-pulse">
               {error}
             </div>
           )}

           {mode === 'login' ? (
             <>
               <div className="space-y-1 animate-fade-in">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1">Username</label>
                 <div className="relative">
                   <UserCircle className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                   <input 
                     type="text" 
                     required
                     className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder-slate-600"
                     placeholder="Enter username"
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                   />
                 </div>
               </div>

               <div className="space-y-1 animate-fade-in">
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1">Password</label>
                 <div className="relative">
                   <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                   <input 
                     type="password" 
                     required
                     className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder-slate-600"
                     placeholder="••••••••"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                   />
                 </div>
               </div>
             </>
           ) : (
             <div className="space-y-1 animate-fade-in">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1">Access PIN</label>
                <div className="relative">
                   <LockKeyhole className="absolute left-3 top-3 w-5 h-5 text-indigo-500" />
                   <input 
                     type="password" 
                     required
                     autoFocus
                     maxLength={8}
                     className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-center tracking-[0.5em] text-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder-slate-800"
                     placeholder="0000"
                     value={kioskPin}
                     onChange={(e) => setKioskPin(e.target.value)}
                   />
                </div>
                <p className="text-[10px] text-center text-slate-500 mt-2">Enter default PIN (0000) to view dashboard.</p>
             </div>
           )}

           <div className="pt-2">
             <button 
               type="submit" 
               disabled={loading}
               className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                 loading 
                  ? 'bg-slate-700 cursor-wait' 
                  : mode === 'login'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.02]'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:scale-[1.02]'
               }`}
             >
               {loading ? (
                 <span className="flex items-center gap-2 text-slate-300">
                   <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                   Authenticating...
                 </span>
               ) : (
                 <>
                   {mode === 'login' ? <Fingerprint className="w-5 h-5" /> : <MonitorPlay className="w-5 h-5" />}
                   {mode === 'login' ? 'Access Dashboard' : 'Start Kiosk Mode'}
                 </>
               )}
             </button>
           </div>
           
           <div className="text-center pt-2">
              <p className="text-[10px] text-slate-600">
                Unauthorized access is prohibited. <br/>All activities are logged.
              </p>
           </div>
        </form>

        <div className="bg-slate-950 p-3 border-t border-slate-800 text-center">
           <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
             <ShieldCheck className="w-3 h-3 text-emerald-500" />
             <span>Encrypted Connection • Version 2.0.1</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
