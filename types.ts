
export enum DeviceType {
  SERVER = 'SERVER',
  PC = 'PC',
  NETWORK = 'NETWORK', // Router, Switch, etc.
  IOT = 'IOT'
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum SnmpVersion {
  V1 = 'v1',
  V2C = 'v2c',
  V3 = 'v3'
}

export const AVAILABLE_LOCATIONS = [
  'Data Center A',
  'Data Center B',
  'Cloud Zone',
  'Server Room A',
  'Server Room B',
  'Network Closet 1',
  'Floor 1',
  'Floor 2',
  'Office 204',
  'Remote Branch'
] as const;

export type DeviceLocation = typeof AVAILABLE_LOCATIONS[number] | string;

export interface SnmpConfig {
  version: SnmpVersion;
  community?: string; // For v1/v2c
  port: number;
  username?: string; // For v3
  authProtocol?: string; // SHA, MD5
  privProtocol?: string; // AES, DES
  timeout: number;
}

export interface Device {
  id: string;
  name: string;
  ip: string;
  type: DeviceType;
  status: DeviceStatus;
  cpuUsage: number; // 0-100
  memoryUsage: number; // 0-100
  temperature: number; // Celsius
  uptime: number; // Seconds
  lastSeen: string; // ISO Date
  location?: DeviceLocation;
  snmpConfig?: SnmpConfig;
}

export interface Alert {
  id: string;
  deviceId: string;
  deviceName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  acknowledged: boolean;
}

export interface SystemStats {
  totalDevices: number;
  online: number;
  offline: number;
  critical: number;
  avgCpuLoad: number;
}

export interface User {
  username: string;
  fullName: string;
  role: 'admin' | 'viewer' | 'kiosk';
}
