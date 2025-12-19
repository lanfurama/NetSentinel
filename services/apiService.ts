const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

interface ApiError {
  success: false;
  error: {
    message: string;
  };
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(username: string, password: string) {
    return this.request<{
      username: string;
      fullName: string;
      role: 'admin' | 'viewer' | 'kiosk';
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async kioskLogin(pin: string) {
    return this.request<{
      username: string;
      fullName: string;
      role: 'kiosk';
    }>('/auth/kiosk', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  }

  async verifyToken(username: string) {
    return this.request<{
      username: string;
      fullName: string;
      role: 'admin' | 'viewer' | 'kiosk';
    }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  // Devices endpoints
  async getDevices(params?: { status?: string; type?: string; location?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.type) query.append('type', params.type);
    if (params?.location) query.append('location', params.location);
    
    const queryString = query.toString();
    return this.request<any[]>('/devices' + (queryString ? `?${queryString}` : ''));
  }

  async getDeviceById(id: string) {
    return this.request<any>(`/devices/${id}`);
  }

  async createDevice(device: any) {
    return this.request<any>('/devices', {
      method: 'POST',
      body: JSON.stringify(device),
    });
  }

  async updateDevice(id: string, updates: any) {
    return this.request<any>(`/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteDevice(id: string) {
    return this.request<void>(`/devices/${id}`, {
      method: 'DELETE',
    });
  }

  async testSnmpConnection(ip: string, snmpConfig: any) {
    return this.request<{
      ip: string;
      port: number;
      version: string;
      reachable: boolean;
    }>('/devices/test-connection', {
      method: 'POST',
      body: JSON.stringify({ ip, snmpConfig }),
    });
  }

  // Alerts endpoints
  async getAlerts(params?: { severity?: string; acknowledged?: boolean; deviceId?: string }) {
    const query = new URLSearchParams();
    if (params?.severity) query.append('severity', params.severity);
    if (params?.acknowledged !== undefined) query.append('acknowledged', String(params.acknowledged));
    if (params?.deviceId) query.append('deviceId', params.deviceId);
    
    const queryString = query.toString();
    return this.request<any[]>('/alerts' + (queryString ? `?${queryString}` : ''));
  }

  async getAlertById(id: string) {
    return this.request<any>(`/alerts/${id}`);
  }

  async createAlert(alert: any) {
    return this.request<any>('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  }

  async acknowledgeAlert(id: string, acknowledgedBy?: string) {
    return this.request<any>(`/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({ acknowledgedBy }),
    });
  }

  async deleteAlert(id: string) {
    return this.request<void>(`/alerts/${id}`, {
      method: 'DELETE',
    });
  }

  // Users endpoints
  async getUsers(params?: { role?: string }) {
    const query = new URLSearchParams();
    if (params?.role) query.append('role', params.role);
    
    const queryString = query.toString();
    return this.request<any[]>('/users' + (queryString ? `?${queryString}` : ''));
  }

  async getUserByUsername(username: string) {
    return this.request<any>(`/users/${username}`);
  }

  // Stats endpoints
  async getSystemStats() {
    return this.request<{
      totalDevices: number;
      online: number;
      offline: number;
      critical: number;
      avgCpuLoad: number;
    }>('/stats');
  }

  // Chat endpoints
  async getMessages(userId: string) {
    const query = new URLSearchParams();
    query.append('userId', userId);
    return this.request<any[]>('/chat/messages' + `?${query.toString()}`);
  }

  async addMessage(userId: string, role: 'user' | 'model', content: string) {
    return this.request<any>('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ userId, role, content }),
    });
  }

  async deleteMessage(id: string) {
    return this.request<void>(`/chat/messages/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteAllMessages(userId: string) {
    const query = new URLSearchParams();
    query.append('userId', userId);
    return this.request<void>('/chat/messages' + `?${query.toString()}`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService();
export default apiService;


