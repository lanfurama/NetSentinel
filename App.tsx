
import React, { useState, useEffect, useCallback } from 'react';
import { Device, DeviceType, DeviceStatus, Alert, SystemStats, SnmpVersion, User } from './types';
import Dashboard from './components/Dashboard';
import DeviceManager from './components/DeviceManager';
import AdminPanel from './components/AdminPanel';
import ChatAssistant from './components/ChatAssistant';
import LoginScreen from './components/LoginScreen';
import { analyzeSystemHealth } from './services/geminiService';
import apiService from './services/apiService';
import { LayoutGrid, List, Brain, Activity, RefreshCw, Settings, MessageSquare, LogOut, UserCircle, X } from './components/Icons';

// Mock data removed - All data now comes from API

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'devices' | 'ai' | 'admin'>('dashboard');
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalDevices: 0,
    online: 0,
    offline: 0,
    critical: 0,
    avgCpuLoad: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [aiReport, setAiReport] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isKioskActive, setIsKioskActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialContext, setChatInitialContext] = useState('');

  // Check Session on Mount
  useEffect(() => {
    const savedUser = localStorage.getItem('NETSENTINEL_USER');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        // Automatically enter Kiosk mode if the user role is 'kiosk'
        if (user.role === 'kiosk') {
          setIsKioskActive(true);
        }
      } catch (e) {
        console.error("Failed to parse user session", e);
        localStorage.removeItem('NETSENTINEL_USER');
      }
    }
  }, []);

  const handleLogin = (user: User) => {
    localStorage.setItem('NETSENTINEL_USER', JSON.stringify(user));
    setCurrentUser(user);
    if (user.role === 'kiosk') {
      setIsKioskActive(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('NETSENTINEL_USER');
    setCurrentUser(null);
    setIsKioskActive(false); // Force exit Kiosk mode on logout
  };

  // Map API device data to frontend Device format
  const mapApiDeviceToDevice = (apiDevice: any): Device => {
    return {
      id: apiDevice.id,
      name: apiDevice.name,
      ip: apiDevice.ip,
      type: apiDevice.type as DeviceType,
      status: apiDevice.status as DeviceStatus,
      cpuUsage: apiDevice.cpuUsage,
      memoryUsage: apiDevice.memoryUsage,
      temperature: apiDevice.temperature,
      uptime: apiDevice.uptime,
      lastSeen: apiDevice.lastSeen,
      location: apiDevice.location,
      snmpConfig: apiDevice.snmpConfig,
    };
  };

  // Map API alert data to frontend Alert format
  const mapApiAlertToAlert = (apiAlert: any): Alert => {
    return {
      id: apiAlert.id,
      deviceId: apiAlert.deviceId,
      deviceName: apiAlert.deviceName,
      message: apiAlert.message,
      severity: apiAlert.severity as 'info' | 'warning' | 'critical',
      timestamp: apiAlert.timestamp,
      acknowledged: apiAlert.acknowledged,
    };
  };

  // Fetch data from API
  const fetchData = useCallback(async () => {
    if (!currentUser) return;

    setIsLoading(true);
    setApiError(null);

    try {
      // Fetch devices, alerts, and stats in parallel
      const [devicesResponse, alertsResponse, statsResponse] = await Promise.all([
        apiService.getDevices(),
        apiService.getAlerts(),
        apiService.getSystemStats(),
      ]);

      if (devicesResponse.success) {
        const mappedDevices = devicesResponse.data.map(mapApiDeviceToDevice);
        setDevices(mappedDevices);
      }

      if (alertsResponse.success) {
        const mappedAlerts = alertsResponse.data.map(mapApiAlertToAlert);
        setAlerts(mappedAlerts);
      }

      if (statsResponse.success) {
        setStats(statsResponse.data);
      }

      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      setApiError(error.message || 'Failed to fetch data from API');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Fetch data on mount and when user logs in
  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  // Poll for updates every 10 seconds
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      fetchData();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [currentUser, fetchData]);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Ensure we stay on dashboard if Kiosk mode activates while on another tab
  useEffect(() => {
    if (isKioskActive && activeTab !== 'dashboard' && activeTab !== 'ai') {
        setActiveTab('dashboard');
    }
  }, [isKioskActive]);

  const handleAddDevice = async (device: Device) => {
    try {
      const response = await apiService.createDevice(device);
      if (response.success) {
        await fetchData(); // Refresh data from API
        setActiveTab('devices');
      }
    } catch (error: any) {
      console.error('Failed to add device:', error);
      setApiError(error.message || 'Failed to add device');
    }
  };

  const handleRemoveDevice = async (id: string) => {
    try {
      await apiService.deleteDevice(id);
      await fetchData(); // Refresh data from API
    } catch (error: any) {
      console.error('Failed to remove device:', error);
      setApiError(error.message || 'Failed to remove device');
    }
  };

  const handleAiAnalysis = async () => {
    if (isAnalyzing) return;
    
    if (devices.length === 0) {
      setApiError('No devices available for analysis. Please add devices first.');
      return;
    }

    setIsAnalyzing(true);
    setAiReport(''); // Clear previous
    setApiError(null);
    
    try {
      const report = await analyzeSystemHealth(devices, alerts);
      setAiReport(report);
    } catch (error: any) {
      console.error('AI Analysis failed:', error);
      setApiError(error.message || 'Failed to generate AI analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskAi = (message: string) => {
    setChatInitialContext(message);
    setIsChatOpen(true);
  };

  // --- RENDER LOGIN IF NOT AUTHENTICATED ---
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className={`w-full md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 transition-all ${isKioskActive ? 'md:w-20' : ''}`}>
        <div className={`p-6 border-b border-slate-800 flex items-center gap-3 ${isKioskActive ? 'justify-center' : ''}`}>
          <div className="bg-blue-600 p-2 rounded-lg shrink-0">
            <Activity className="w-6 h-6 text-white" />
          </div>
          {!isKioskActive && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              NetSentinel
            </h1>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            } ${isKioskActive ? 'justify-center' : ''}`}
            title="Dashboard"
          >
            <LayoutGrid className="w-5 h-5 shrink-0" />
            {!isKioskActive && <span className="font-medium">Dashboard</span>}
          </button>

          {!isKioskActive && (
            <button
              onClick={() => setActiveTab('devices')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'devices' 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <List className="w-5 h-5 shrink-0" />
              <span className="font-medium">All Devices</span>
              <span className="ml-auto bg-slate-800 text-xs px-2 py-0.5 rounded-full text-slate-400">
                {devices.length}
              </span>
            </button>
          )}

          {!isKioskActive && currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'admin' 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span className="font-medium">Admin & SNMP</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('ai')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'ai' 
                ? 'bg-purple-600/10 text-purple-400 border border-purple-600/20' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            } ${isKioskActive ? 'justify-center' : ''}`}
            title="AI Insights"
          >
            <Brain className="w-5 h-5 shrink-0" />
            {!isKioskActive && <span className="font-medium">AI Insights</span>}
          </button>
        </nav>

        {!isKioskActive && (
          <div className="p-4 border-t border-slate-800 space-y-3">
             {/* User Profile Info */}
             <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                   <UserCircle className="w-5 h-5 text-slate-400" />
                </div>
                <div className="overflow-hidden">
                   <p className="text-sm font-bold text-white truncate">{currentUser.fullName}</p>
                   <p className="text-[10px] text-slate-500 uppercase font-semibold">{currentUser.role}</p>
                </div>
             </div>
             
             {/* Logout & Status */}
             <div className="flex gap-2">
                <div className="bg-slate-900 rounded-lg p-2 flex-1 text-xs text-slate-500 flex items-center gap-2">
                   <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                   </span>
                   <span className="truncate">Active</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 p-2 rounded-lg transition-colors"
                  title="Logout"
                >
                   <LogOut className="w-4 h-4" />
                </button>
             </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-screen bg-slate-900 relative">
         <div className="max-w-7xl mx-auto p-4 md:p-8">
            {/* Header for Mobile/Context - Hide in Kiosk */}
            {!isKioskActive && (
              <header className="flex md:hidden justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white capitalize">{activeTab}</h2>
                <button 
                  onClick={handleRefresh} 
                  disabled={isLoading}
                  className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-5 h-5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </header>
            )}

            {/* API Error Display */}
            {apiError && (
              <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-red-300 text-sm">{apiError}</p>
                  <button 
                    onClick={() => setApiError(null)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <Dashboard 
                devices={devices} 
                stats={stats} 
                isKioskActive={isKioskActive}
                setKioskActive={setIsKioskActive}
              />
            )}

            {activeTab === 'devices' && !isKioskActive && (
              <DeviceManager 
                devices={devices} 
                onAddDevice={handleAddDevice} 
                onRemoveDevice={handleRemoveDevice} 
              />
            )}

            {activeTab === 'admin' && !isKioskActive && currentUser.role === 'admin' && (
              <AdminPanel 
                onAddDevice={handleAddDevice} 
                onAskAi={handleAskAi} 
              />
            )}

            {activeTab === 'ai' && (
              <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                 <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 border border-indigo-700/50 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                    <div className="relative z-10">
                      <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Brain className="w-8 h-8 text-purple-300" /> AI System Analyst
                      </h2>
                      <p className="text-indigo-200 mb-4">
                        Use Gemini 2.5 Flash to analyze your network infrastructure logs and status snapshots for anomalies and optimization opportunities.
                      </p>
                      <div className="mb-6 text-sm text-indigo-300/80">
                        <p>Ready to analyze <span className="font-bold text-white">{devices.length}</span> device{devices.length !== 1 ? 's' : ''} and <span className="font-bold text-white">{alerts.length}</span> alert{alerts.length !== 1 ? 's' : ''}</p>
                      </div>
                      <button 
                        onClick={handleAiAnalysis}
                        disabled={isAnalyzing || devices.length === 0}
                        className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
                          isAnalyzing || devices.length === 0
                          ? 'bg-slate-700 cursor-not-allowed opacity-50' 
                          : 'bg-white text-indigo-900 hover:bg-indigo-50 hover:scale-105'
                        }`}
                      >
                        {isAnalyzing ? (
                          <RefreshCw className="w-5 h-5 animate-spin" /> 
                        ) : (
                          <Activity className="w-5 h-5" />
                        )}
                        {isAnalyzing 
                          ? `Analyzing ${devices.length} devices...` 
                          : devices.length === 0 
                            ? 'No devices to analyze' 
                            : 'Generate Health Report'}
                      </button>
                    </div>
                 </div>

                 {aiReport && (
                   <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
                      <h3 className="text-xl font-bold text-white mb-4 border-b border-slate-700 pb-2">Analysis Result</h3>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-slate-300">
                          {aiReport}
                        </pre>
                      </div>
                   </div>
                 )}
                 
                 {!aiReport && !isAnalyzing && (
                   <div className="text-center py-12 text-slate-600">
                     <Brain className="w-16 h-16 mx-auto mb-4 opacity-20" />
                     {devices.length === 0 ? (
                       <>
                         <p className="text-lg font-medium mb-2">No devices available</p>
                         <p className="text-sm">Add devices to your network to enable AI analysis.</p>
                       </>
                     ) : (
                       <p>Ready to analyze {devices.length} device{devices.length !== 1 ? 's' : ''} across your network.</p>
                     )}
                   </div>
                 )}
              </div>
            )}
         </div>

         {/* Chat Assistant Widget */}
         <ChatAssistant 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)}
            devices={devices}
            alerts={alerts}
            initialContext={chatInitialContext}
         />

         {/* Chat Toggle Button (Visible when chat is closed AND not in Kiosk mode) */}
         {!isChatOpen && !isKioskActive && (
           <button 
             onClick={() => {
               setChatInitialContext('');
               setIsChatOpen(true);
             }}
             className="fixed bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl transition-all hover:scale-110 z-40 group"
           >
             <MessageSquare className="w-6 h-6" />
             <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none border border-slate-700">
               Chat with Assistant
             </span>
           </button>
         )}
      </main>
    </div>
  );
};

export default App;
