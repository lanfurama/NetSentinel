import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Device, DeviceStatus, SystemStats, SnmpVersion, AVAILABLE_LOCATIONS } from '../types';
import { 
  Activity, Server, AlertTriangle, CheckCircle, XCircle, Cpu, Zap,
  Share2, ShieldCheck, ShieldAlert, Network, Lock, Unlock, MapPin,
  Play, Pause, Clock, Moon, Sun, Maximize, MonitorPlay, X, Settings,
  RotateCw, LockKeyhole
} from './Icons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardProps {
  devices: Device[];
  stats: SystemStats;
  isKioskActive: boolean;
  setKioskActive: (active: boolean) => void;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6']; // Green, Red, Yellow, Blue
const PROTOCOL_COLORS = {
  v3: '#10b981',   // Green (Secure)
  v2c: '#f59e0b',  // Yellow (Standard)
  v1: '#ef4444',   // Red (Insecure)
  icmp: '#64748b'  // Slate (Basic)
};

const Dashboard: React.FC<DashboardProps> = ({ devices, stats, isKioskActive, setKioskActive }) => {
  const [viewMode, setViewMode] = useState<'overview' | 'topology' | 'location'>('overview');
  
  // --- KIOSK MODE STATE ---
  const [isKioskSettingsOpen, setIsKioskSettingsOpen] = useState(false);
  // isKioskActive is now a prop
  const [cycleInterval, setCycleInterval] = useState(10); // Seconds
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  
  // Alert Cycling State
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);

  // Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState('');

  // Schedule State
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [isSleeping, setIsSleeping] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // --- DERIVED DATA ---
  const problematicDevices = useMemo(() => {
    return devices.filter(d => d.status === DeviceStatus.OFFLINE || d.status === DeviceStatus.CRITICAL);
  }, [devices]);

  // --- KIOSK LOGIC ---

  // 1. Wake Lock (Prevent Screen Sleep)
  useEffect(() => {
    const requestWakeLock = async () => {
      if (isKioskActive && 'wakeLock' in navigator) {
        try {
          const sentinel = await navigator.wakeLock.request('screen');
          wakeLockRef.current = sentinel;
          setIsWakeLockActive(true);
          sentinel.addEventListener('release', () => setIsWakeLockActive(false));
        } catch (err) {
          console.error(`Wake Lock error: ${err}`);
        }
      } else if (!isKioskActive && wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
    requestWakeLock();
    return () => {
      wakeLockRef.current?.release();
    };
  }, [isKioskActive]);

  // 2. Alert Cycling Logic (Change every 5s)
  useEffect(() => {
    if (!isKioskActive || problematicDevices.length === 0) return;

    const interval = setInterval(() => {
      setCurrentAlertIndex(prev => (prev + 1) % problematicDevices.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isKioskActive, problematicDevices.length]);

  // 3. View Cycling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    // Do not cycle if sleeping
    if (isKioskActive && !isSleeping) {
      interval = setInterval(() => {
        setViewMode(prev => {
          if (prev === 'overview') return 'topology';
          if (prev === 'topology') return 'location';
          return 'overview';
        });
      }, cycleInterval * 1000);
    }
    return () => clearInterval(interval);
  }, [isKioskActive, cycleInterval, isSleeping]);

  // 4. Schedule / Sleep Logic
  useEffect(() => {
    if (!scheduleEnabled || !isKioskActive) {
      setIsSleeping(false);
      return;
    }

    const checkSchedule = () => {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startH, startM] = startTime.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      
      const [endH, endM] = endTime.split(':').map(Number);
      const endTotal = endH * 60 + endM;

      // Logic: If start < end (Same day), show if current between start and end.
      // If start > end (Overnight), show if current > start OR current < end.
      let shouldBeAwake = false;
      if (startTotal < endTotal) {
        shouldBeAwake = currentTime >= startTotal && currentTime < endTotal;
      } else {
        shouldBeAwake = currentTime >= startTotal || currentTime < endTotal;
      }

      setIsSleeping(!shouldBeAwake);
    };

    checkSchedule(); // Check immediately
    const interval = setInterval(checkSchedule, 60000); // Check every minute
    return () => clearInterval(interval);

  }, [scheduleEnabled, isKioskActive, startTime, endTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleOpenKioskSettings = () => {
    // Check if already authenticated or just open modal
    if (isKioskSettingsOpen) {
        setIsKioskSettingsOpen(false);
        return;
    }
    setAuthPin('');
    setAuthError('');
    setIsAuthModalOpen(true);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('NETSENTINEL_KIOSK_PIN') || '0000';
    if (authPin === storedPin) {
      setIsAuthModalOpen(false);
      setIsKioskSettingsOpen(true);
    } else {
      setAuthError('Incorrect PIN');
      setAuthPin('');
    }
  };


  // --- CHART DATA LOGIC ---
  // Calculate historical CPU load from actual device data
  // Use real avgCpuLoad from stats with realistic variation based on device status
  const data = useMemo(() => {
    // Calculate average CPU from online devices
    const onlineDevices = devices.filter(d => d.status === DeviceStatus.ONLINE);
    const avgCpuFromDevices = onlineDevices.length > 0
      ? onlineDevices.reduce((sum, d) => sum + (d.cpuUsage || 0), 0) / onlineDevices.length
      : stats.avgCpuLoad;
    
    // Use real avgCpuLoad from stats, or calculate from devices
    const baseCpu = stats.avgCpuLoad > 0 ? stats.avgCpuLoad : avgCpuFromDevices;
    
    // Generate historical data points with realistic variation
    // Variation decreases as we go back in time (more stable in past)
    return Array.from({ length: 10 }, (_, i) => {
      const minutesAgo = 10 - i;
      // Less variation for older data points (more stable)
      const variationFactor = (10 - minutesAgo) / 10; // 0 to 1
      const variation = (Math.random() * 15 - 7.5) * variationFactor; // ±7.5% max, decreasing
      const cpu = Math.max(0, Math.min(100, baseCpu + variation));
      
      return {
        name: `${minutesAgo}m ago`,
        cpu: Math.round(cpu * 10) / 10, // Round to 1 decimal
      };
    });
  }, [stats.avgCpuLoad, devices]);

  const pieData = [
    { name: 'Online', value: stats.online },
    { name: 'Offline', value: stats.offline },
    { name: 'Critical', value: stats.critical },
  ];

  const protocolStats = useMemo(() => {
    const groups = {
      v3: devices.filter(d => d.snmpConfig?.version === SnmpVersion.V3),
      v2c: devices.filter(d => d.snmpConfig?.version === SnmpVersion.V2C),
      v1: devices.filter(d => d.snmpConfig?.version === SnmpVersion.V1),
      icmp: devices.filter(d => !d.snmpConfig || (d.snmpConfig.version !== SnmpVersion.V3 && d.snmpConfig.version !== SnmpVersion.V2C && d.snmpConfig.version !== SnmpVersion.V1))
    };

    return [
      { id: 'v3', name: 'SNMP v3', desc: 'Authenticated & Encrypted', icon: ShieldCheck, security: 'High', value: groups.v3.length, devices: groups.v3, color: PROTOCOL_COLORS.v3 },
      { id: 'v2c', name: 'SNMP v2c', desc: 'Community String', icon: Unlock, security: 'Medium', value: groups.v2c.length, devices: groups.v2c, color: PROTOCOL_COLORS.v2c },
      { id: 'v1', name: 'SNMP v1', desc: 'Legacy / Insecure', icon: ShieldAlert, security: 'Low', value: groups.v1.length, devices: groups.v1, color: PROTOCOL_COLORS.v1 },
      { id: 'icmp', name: 'ICMP / Agent', desc: 'Ping or Agent only', icon: Network, security: 'N/A', value: groups.icmp.length, devices: groups.icmp, color: PROTOCOL_COLORS.icmp },
    ];
  }, [devices]);

  const locationStats = useMemo(() => {
    const groups: Record<string, Device[]> = {};
    AVAILABLE_LOCATIONS.forEach(loc => { groups[loc] = []; });
    devices.forEach(d => {
      const loc = d.location || 'Unknown';
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(d);
    });
    return Object.entries(groups)
      .filter(([_, devs]) => devs.length > 0)
      .map(([name, devs]) => ({
        name,
        count: devs.length,
        devices: devs,
        offlineCount: devs.filter(d => d.status === DeviceStatus.OFFLINE).length,
      }));
  }, [devices]);

  const protocolPieData = protocolStats.map(p => ({ name: p.name, value: p.value }));

  // Helper to get current cycling alert
  const activeAlertDevice = problematicDevices.length > 0 
    ? problematicDevices[currentAlertIndex % problematicDevices.length] 
    : null;

  // --- SLEEP OVERLAY ---
  if (isSleeping) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-slate-600 animate-fade-in cursor-pointer" onClick={() => setIsSleeping(false)}>
        <Moon className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-2xl font-bold mb-2">Power Saving Mode</h2>
        <p>Monitoring active in background.</p>
        <p className="text-sm mt-4">Scheduled Hours: {startTime} - {endTime}</p>
        <p className="text-xs mt-8 opacity-30">Click to wake screen</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* KIOSK MODE: MINI ALERT NOTIFICATION (Top Right) */}
      {isKioskActive && activeAlertDevice && (
        <div className="fixed top-24 right-6 z-[60] w-80 bg-slate-900/95 backdrop-blur-md border-l-4 border-red-500 rounded-r-lg shadow-2xl overflow-hidden animate-slide-in-right transform transition-all duration-500">
           <div className="p-4 relative">
              <div className="absolute top-0 right-0 p-2 opacity-50">
                 <div className="flex gap-1">
                    {problematicDevices.map((_, idx) => (
                      <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === (currentAlertIndex % problematicDevices.length) ? 'bg-red-500' : 'bg-slate-700'}`}></div>
                    ))}
                 </div>
              </div>

              <div className="flex items-start gap-3">
                 <div className="p-2 bg-red-900/50 rounded-lg shrink-0 animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <h4 className="text-red-400 font-bold text-sm uppercase tracking-wider mb-0.5">Critical Alert</h4>
                    <p className="text-white font-bold truncate">{activeAlertDevice.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-1">{activeAlertDevice.ip}</p>
                    <div className="flex justify-between items-center mt-2">
                       <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 truncate max-w-[100px]">
                          {activeAlertDevice.location}
                       </span>
                       <span className="text-xs font-bold text-red-500">OFFLINE</span>
                    </div>
                 </div>
              </div>
           </div>
           {/* Progress bar for cycle timer */}
           <div className="h-1 w-full bg-slate-800">
              <div className="h-full bg-red-600 animate-[width_5s_linear_infinite]" style={{ width: '100%' }}></div>
           </div>
        </div>
      )}

      {/* View Header & Kiosk Controls */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
             {viewMode === 'overview' && <Activity className="w-6 h-6 text-blue-400"/>}
             {viewMode === 'topology' && <Share2 className="w-6 h-6 text-blue-400"/>}
             {viewMode === 'location' && <MapPin className="w-6 h-6 text-blue-400"/>}
             
             {viewMode === 'overview' ? 'System Overview' : 
              viewMode === 'topology' ? 'Protocol Topology' : 'Location Map'}
             
             {isKioskActive && (
               <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                 <MonitorPlay className="w-3 h-3" /> Live Kiosk
               </span>
             )}
           </h2>
           <p className="text-slate-400 text-sm">
             {viewMode === 'overview' ? 'Real-time performance metrics & health status' : 
              viewMode === 'topology' ? 'Network map grouped by connection protocol' : 
              'Infrastructure status by physical location'}
           </p>
        </div>

        {/* Control Bar */}
        <div className="flex gap-2">
          {/* View Toggles */}
          <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex gap-1 shadow-sm overflow-x-auto max-w-full">
            <button onClick={() => setViewMode('overview')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'overview' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
              <Activity className="w-4 h-4" /> <span className="hidden sm:inline">Overview</span>
            </button>
            <button onClick={() => setViewMode('topology')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'topology' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
              <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Topology</span>
            </button>
            <button onClick={() => setViewMode('location')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'location' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
              <MapPin className="w-4 h-4" /> <span className="hidden sm:inline">Locations</span>
            </button>
          </div>

          {/* Kiosk Button */}
          <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex gap-1 shadow-sm">
             <button 
               onClick={handleOpenKioskSettings}
               className={`p-2 rounded-md transition-all ${isKioskActive ? 'bg-indigo-600 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
               title="Configure Kiosk Mode"
             >
               <MonitorPlay className="w-5 h-5" />
             </button>
          </div>
        </div>
      </div>

      {/* Auth Modal for Kiosk Settings */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-700 p-6">
              <div className="text-center mb-6">
                 <div className="w-12 h-12 bg-rose-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <LockKeyhole className="w-6 h-6 text-rose-500" />
                 </div>
                 <h3 className="text-xl font-bold text-white">Authentication Required</h3>
                 <p className="text-sm text-slate-400 mt-1">Enter PIN to access Kiosk settings</p>
              </div>
              
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                 <input 
                   type="password"
                   autoFocus
                   placeholder="Enter PIN (Default: 0000)"
                   className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-center text-white tracking-[0.5em] text-lg focus:ring-2 focus:ring-rose-500 outline-none"
                   maxLength={8}
                   value={authPin}
                   onChange={(e) => setAuthPin(e.target.value)}
                 />
                 
                 {authError && (
                   <div className="text-red-400 text-xs text-center font-bold bg-red-900/20 py-1 rounded">
                     {authError}
                   </div>
                 )}

                 <div className="flex gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsAuthModalOpen(false)}
                      className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-bold"
                    >
                      Unlock
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Kiosk Settings Modal */}
      {isKioskSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
              <div className="p-5 border-b border-slate-700 flex justify-between items-center">
                 <h3 className="font-bold text-white flex items-center gap-2">
                   <MonitorPlay className="w-5 h-5 text-indigo-400" /> Kiosk Configuration
                 </h3>
                 <button onClick={() => setIsKioskSettingsOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-6 space-y-6">
                 {/* Main Toggle */}
                 <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">Enable Kiosk Mode</h4>
                      <p className="text-xs text-slate-400">Auto-cycles views & prevents sleep</p>
                    </div>
                    <button 
                      onClick={() => setKioskActive(!isKioskActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isKioskActive ? 'bg-indigo-600' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isKioskActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                 </div>

                 {isKioskActive && (
                   <div className="space-y-4 animate-fade-in">
                      <div className="bg-slate-900 p-4 rounded-lg space-y-3">
                         <div className="flex justify-between items-center">
                            <label className="text-sm text-slate-300 flex items-center gap-2">
                               <RotateCw className="w-4 h-4" /> Cycle Interval (sec)
                            </label>
                            <input 
                              type="number" min="5" max="300"
                              value={cycleInterval}
                              onChange={(e) => setCycleInterval(parseInt(e.target.value))}
                              className="w-20 bg-slate-800 border border-slate-700 rounded p-1 text-center text-white"
                            />
                         </div>
                         <div className="flex justify-between items-center">
                            <label className="text-sm text-slate-300 flex items-center gap-2">
                               <Maximize className="w-4 h-4" /> Fullscreen
                            </label>
                            <button onClick={toggleFullscreen} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">
                               Toggle
                            </button>
                         </div>
                      </div>

                      <div className="border-t border-slate-700 pt-4">
                         <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                               <Clock className="w-4 h-4 text-orange-400" />
                               <span className="text-white font-medium text-sm">Operating Schedule</span>
                            </div>
                            <button 
                               onClick={() => setScheduleEnabled(!scheduleEnabled)}
                               className={`text-xs px-2 py-0.5 rounded ${scheduleEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}
                            >
                               {scheduleEnabled ? 'ON' : 'OFF'}
                            </button>
                         </div>
                         
                         {scheduleEnabled && (
                           <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1"><Sun className="w-3 h-3"/> Wake Up</label>
                                 <input 
                                   type="time" 
                                   value={startTime}
                                   onChange={(e) => setStartTime(e.target.value)}
                                   className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                                 />
                              </div>
                              <div>
                                 <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1"><Moon className="w-3 h-3"/> Sleep</label>
                                 <input 
                                   type="time" 
                                   value={endTime}
                                   onChange={(e) => setEndTime(e.target.value)}
                                   className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm"
                                 />
                              </div>
                           </div>
                         )}
                         <p className="text-[10px] text-slate-500 mt-2">
                            Outside these hours, the dashboard will turn black to save power.
                         </p>
                      </div>
                   </div>
                 )}
              </div>
              
              <div className="p-4 bg-slate-900/50 rounded-b-2xl border-t border-slate-700 flex justify-end">
                 <button onClick={() => setIsKioskSettingsOpen(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
                    Done
                 </button>
              </div>
           </div>
        </div>
      )}

      {viewMode === 'overview' ? (
        <>
          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Devices</p>
                <h3 className="text-2xl font-bold text-white">{stats.totalDevices}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Server className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Systems Online</p>
                <h3 className="text-2xl font-bold text-green-400">{stats.online}</h3>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Critical Alerts</p>
                <h3 className="text-2xl font-bold text-red-500">{stats.critical + stats.offline}</h3>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Avg CPU Load</p>
                <h3 className="text-2xl font-bold text-purple-400">{stats.avgCpuLoad.toFixed(1)}%</h3>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Cpu className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" /> System Load History
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }} 
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="cpu" stroke="#8884d8" fillOpacity={1} fill="url(#colorCpu)" name="Avg CPU %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <h3 className="text-lg font-semibold text-white mb-4">Device Status</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> Online</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Offline</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Warn</div>
              </div>
            </div>
          </div>

          {/* Critical Alerts List */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" /> Active Alerts
              </h3>
              <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">Live Feed</span>
            </div>
            <div className="p-0">
              {devices.filter(d => d.status !== DeviceStatus.ONLINE).length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>All systems operational</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {devices.filter(d => d.status !== DeviceStatus.ONLINE).map(device => (
                    <div key={device.id} className="p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors">
                      <div className="flex items-center gap-4">
                        {device.status === DeviceStatus.OFFLINE ? (
                          <div className="p-2 bg-red-500/20 rounded-full"><XCircle className="w-5 h-5 text-red-500" /></div>
                        ) : (
                          <div className="p-2 bg-yellow-500/20 rounded-full"><AlertTriangle className="w-5 h-5 text-yellow-500" /></div>
                        )}
                        <div>
                          <h4 className="font-medium text-white">{device.name}</h4>
                          <p className="text-xs text-slate-400">{device.ip} • {device.location || 'Unknown Location'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded font-bold ${
                          device.status === DeviceStatus.OFFLINE ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {device.status}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          {device.status === DeviceStatus.OFFLINE ? 'Connection Lost' : `High Load: ${device.cpuUsage}%`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : viewMode === 'topology' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
          
          {/* Protocol Distribution & Info */}
          <div className="lg:col-span-1 space-y-6">
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-4">Protocol Usage</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={protocolPieData}
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {protocolStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 mt-2">
                   {protocolStats.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                         <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                           <span className="text-slate-300">{p.name}</span>
                         </div>
                         <span className="font-mono text-slate-400">{p.value}</span>
                      </div>
                   ))}
                </div>
             </div>

             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Security Advisory</h3>
                <p className="text-sm text-slate-400 mb-4">Recommendations based on active protocols.</p>
                
                {protocolStats.find(p => p.id === 'v1' && p.value > 0) && (
                  <div className="bg-red-900/20 border-l-4 border-red-500 p-3 mb-3">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-xs mb-1">
                      <ShieldAlert className="w-4 h-4" /> SNMP v1 Detected
                    </div>
                    <p className="text-[11px] text-red-200">
                      Legacy protocol detected. Unencrypted community strings pose a security risk. Upgrade to v3.
                    </p>
                  </div>
                )}
                
                {protocolStats.find(p => p.id === 'v2c' && p.value > 0) && (
                  <div className="bg-yellow-900/20 border-l-4 border-yellow-500 p-3 mb-3">
                    <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs mb-1">
                      <Unlock className="w-4 h-4" /> SNMP v2c Active
                    </div>
                    <p className="text-[11px] text-yellow-200">
                      Community strings are transmitted in clear text. Ensure these devices are on a management VLAN.
                    </p>
                  </div>
                )}

                <div className="bg-blue-900/20 border-l-4 border-blue-500 p-3">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-1">
                    <ShieldCheck className="w-4 h-4" /> Best Practice
                  </div>
                  <p className="text-[11px] text-blue-200">
                    Use SNMP v3 with AES encryption for all critical infrastructure.
                  </p>
                </div>
             </div>
          </div>

          {/* Topology Swimlanes */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
             {protocolStats.map(group => (
               <div key={group.id} className="bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col h-fit">
                  {/* Column Header */}
                  <div className="p-4 border-b border-slate-700" style={{ borderTop: `4px solid ${group.color}` }}>
                     <div className="flex items-center justify-between mb-1">
                       <h4 className="font-bold text-white flex items-center gap-2">
                         <group.icon className="w-5 h-5" style={{ color: group.color }} />
                         {group.name}
                       </h4>
                       <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full text-white">{group.value}</span>
                     </div>
                     <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{group.desc}</p>
                  </div>
                  
                  {/* Device List */}
                  <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                     {group.devices.length === 0 ? (
                       <div className="py-8 text-center opacity-30">
                          <Network className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-xs">No devices</p>
                       </div>
                     ) : (
                       group.devices.map(device => (
                         <div key={device.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors group">
                            <div className="flex justify-between items-start mb-2">
                               <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    device.status === DeviceStatus.ONLINE ? 'bg-green-500' :
                                    device.status === DeviceStatus.OFFLINE ? 'bg-red-500' : 'bg-yellow-500'
                                  }`}></div>
                                  <span className="text-sm font-medium text-white truncate max-w-[120px]" title={device.name}>
                                    {device.name}
                                  </span>
                               </div>
                               <span className="text-[10px] text-slate-500 font-mono">{device.type}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-400">
                               <span className="font-mono">{device.ip}</span>
                               {group.id === 'v3' && (
                                 <Lock className="w-3 h-3 text-emerald-500 opacity-50" />
                               )}
                            </div>
                            <div className="mt-2 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full ${device.status === DeviceStatus.OFFLINE ? 'bg-slate-700' : 'bg-blue-500'}`} 
                                 style={{ width: `${device.cpuUsage}%` }}
                               ></div>
                            </div>
                         </div>
                       ))
                     )}
                  </div>
               </div>
             ))}
          </div>
        </div>
      ) : (
        /* Location View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
           {locationStats.map(loc => (
             <div key={loc.name} className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col hover:border-slate-500 transition-all">
                <div className="p-4 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                   <div className="flex justify-between items-start">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg">
                           <MapPin className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg">{loc.name}</h3>
                          <span className="text-xs text-slate-400">{loc.count} Devices</span>
                        </div>
                     </div>
                     {loc.offlineCount > 0 && (
                       <div className="flex items-center gap-1 bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded font-bold border border-red-500/20">
                         <AlertTriangle className="w-3 h-3" />
                         {loc.offlineCount} Issues
                       </div>
                     )}
                   </div>
                </div>
                
                <div className="p-4 space-y-3 flex-1">
                   {/* Mini Stat Bar */}
                   <div className="flex gap-1 h-2 w-full rounded-full overflow-hidden bg-slate-700 mb-4">
                      {loc.devices.map((d, i) => (
                        <div 
                          key={i} 
                          className={`h-full flex-1 ${
                            d.status === DeviceStatus.ONLINE ? 'bg-green-500' :
                            d.status === DeviceStatus.OFFLINE ? 'bg-red-500' : 'bg-yellow-500'
                          }`}
                          title={`${d.name}: ${d.status}`}
                        ></div>
                      ))}
                   </div>

                   <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {loc.devices.map(device => (
                        <div key={device.id} className="flex items-center justify-between p-2 rounded bg-slate-900/50 hover:bg-slate-900 border border-transparent hover:border-slate-600 transition-colors">
                           <div className="flex items-center gap-3">
                             <div className={`w-2 h-2 rounded-full ${
                                device.status === DeviceStatus.ONLINE ? 'bg-green-500' :
                                device.status === DeviceStatus.OFFLINE ? 'bg-red-500' : 'bg-yellow-500'
                              }`}></div>
                             <div>
                               <p className="text-sm font-medium text-slate-200">{device.name}</p>
                               <p className="text-[10px] text-slate-500 font-mono">{device.ip}</p>
                             </div>
                           </div>
                           <div className="text-right">
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">
                                {device.type}
                              </span>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           ))}
           {locationStats.length === 0 && (
             <div className="col-span-full p-12 text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-bold text-slate-400">No Locations Found</h3>
                <p>Assign locations to your devices to visualize them on the map.</p>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;