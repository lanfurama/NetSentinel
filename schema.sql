-- PostgreSQL Database Schema for NetSentinel
-- Generated from types.ts

-- Suppress NOTICE messages for cleaner output
SET client_min_messages TO WARNING;

-- Drop existing objects if they exist (for clean setup)
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS device_type CASCADE;
DROP TYPE IF EXISTS device_status CASCADE;
DROP TYPE IF EXISTS snmp_version CASCADE;
DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Create ENUM types
CREATE TYPE device_type AS ENUM ('SERVER', 'PC', 'NETWORK', 'IOT');
CREATE TYPE device_status AS ENUM ('ONLINE', 'OFFLINE', 'WARNING', 'CRITICAL');
CREATE TYPE snmp_version AS ENUM ('v1', 'v2c', 'v3');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE user_role AS ENUM ('admin', 'viewer', 'kiosk');

-- Create Users table
CREATE TABLE users (
    username VARCHAR(100) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ip INET NOT NULL,
    type device_type NOT NULL,
    status device_status NOT NULL DEFAULT 'OFFLINE',
    cpu_usage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
    memory_usage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (memory_usage >= 0 AND memory_usage <= 100),
    temperature DECIMAL(6,2),
    uptime BIGINT NOT NULL DEFAULT 0 CHECK (uptime >= 0), -- Seconds
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    location VARCHAR(255),
    snmp_config JSONB, -- Stores SnmpConfig as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_ip UNIQUE (ip)
);

-- Create Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity alert_severity NOT NULL DEFAULT 'info',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alert_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_user FOREIGN KEY (acknowledged_by) REFERENCES users(username) ON DELETE SET NULL
);

-- Create Chat Conversations table
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(username) ON DELETE CASCADE
);

-- Create Chat Messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_type ON devices(type);
CREATE INDEX idx_devices_location ON devices(location);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);
CREATE INDEX idx_alerts_device_id ON alerts(device_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_updated ON chat_conversations(updated_at DESC);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- Create GIN index for JSONB snmp_config queries
CREATE INDEX idx_devices_snmp_config ON devices USING GIN (snmp_config);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for SystemStats (aggregated statistics)
CREATE OR REPLACE VIEW system_stats AS
SELECT 
    COUNT(*)::INTEGER AS total_devices,
    COUNT(*) FILTER (WHERE status = 'ONLINE')::INTEGER AS online,
    COUNT(*) FILTER (WHERE status = 'OFFLINE')::INTEGER AS offline,
    COUNT(*) FILTER (WHERE status = 'CRITICAL')::INTEGER AS critical,
    COALESCE(AVG(cpu_usage), 0)::DECIMAL(5,2) AS avg_cpu_load
FROM devices;

-- Insert default locations constraint (optional - can be enforced at application level)
-- The location column accepts any string, but you can add a CHECK constraint if needed
-- ALTER TABLE devices ADD CONSTRAINT check_location 
--     CHECK (location IN (
--         'Data Center A', 'Data Center B', 'Cloud Zone', 
--         'Server Room A', 'Server Room B', 'Network Closet 1',
--         'Floor 1', 'Floor 2', 'Office 204', 'Remote Branch'
--     ) OR location IS NULL);

-- Insert sample data
-- Users (passwords are plain text for demo - in production use bcrypt)
INSERT INTO users (username, full_name, password, role) VALUES
    ('admin', 'System Administrator', 'admin123', 'admin'),
    ('viewer1', 'John Doe', 'view123', 'viewer'),
    ('viewer2', 'Jane Smith', 'view123', 'viewer'),
    ('kiosk1', 'Kiosk Display', '0000', 'kiosk');

-- Devices with various types and statuses
INSERT INTO devices (name, ip, type, status, cpu_usage, memory_usage, temperature, uptime, last_seen, location, snmp_config) VALUES
    -- Servers
    ('Web Server 01', '192.168.1.10', 'SERVER', 'ONLINE', 45.5, 62.3, 42.5, 2592000, CURRENT_TIMESTAMP - INTERVAL '5 minutes', 'Data Center A', 
     '{"version": "v2c", "community": "public", "port": 161, "timeout": 5000}'::jsonb),
    
    ('Database Server 01', '192.168.1.11', 'SERVER', 'ONLINE', 78.2, 85.7, 55.3, 5184000, CURRENT_TIMESTAMP - INTERVAL '2 minutes', 'Data Center A',
     '{"version": "v3", "port": 161, "username": "dbadmin", "authProtocol": "SHA", "privProtocol": "AES", "timeout": 5000}'::jsonb),
    
    ('App Server 02', '192.168.1.12', 'SERVER', 'WARNING', 92.5, 88.1, 68.7, 1728000, CURRENT_TIMESTAMP - INTERVAL '15 minutes', 'Data Center B',
     '{"version": "v2c", "community": "private", "port": 161, "timeout": 3000}'::jsonb),
    
    ('Backup Server', '192.168.1.20', 'SERVER', 'OFFLINE', 0, 0, NULL, 0, CURRENT_TIMESTAMP - INTERVAL '2 hours', 'Server Room A',
     '{"version": "v1", "community": "public", "port": 161, "timeout": 5000}'::jsonb),
    
    -- Network Devices
    ('Core Router', '10.0.0.1', 'NETWORK', 'ONLINE', 25.3, 40.2, 38.5, 31536000, CURRENT_TIMESTAMP - INTERVAL '1 minute', 'Data Center A',
     '{"version": "v2c", "community": "public", "port": 161, "timeout": 5000}'::jsonb),
    
    ('Switch 01', '192.168.1.100', 'NETWORK', 'ONLINE', 15.8, 22.5, 35.2, 2592000, CURRENT_TIMESTAMP - INTERVAL '3 minutes', 'Network Closet 1',
     '{"version": "v2c", "community": "public", "port": 161, "timeout": 5000}'::jsonb),
    
    ('Firewall', '192.168.1.1', 'NETWORK', 'CRITICAL', 98.5, 95.2, 75.8, 604800, CURRENT_TIMESTAMP - INTERVAL '30 seconds', 'Data Center A',
     '{"version": "v3", "port": 161, "username": "fwadmin", "authProtocol": "SHA", "privProtocol": "AES", "timeout": 5000}'::jsonb),
    
    ('Edge Router', '203.0.113.1', 'NETWORK', 'ONLINE', 35.7, 45.3, 42.1, 2592000, CURRENT_TIMESTAMP - INTERVAL '1 minute', 'Remote Branch',
     '{"version": "v2c", "community": "public", "port": 161, "timeout": 5000}'::jsonb),
    
    -- PCs
    ('Workstation PC-01', '192.168.2.10', 'PC', 'ONLINE', 32.5, 48.7, 45.2, 86400, CURRENT_TIMESTAMP - INTERVAL '10 minutes', 'Floor 1',
     NULL),
    
    ('Workstation PC-02', '192.168.2.11', 'PC', 'ONLINE', 28.3, 42.1, 42.8, 72000, CURRENT_TIMESTAMP - INTERVAL '5 minutes', 'Floor 1',
     NULL),
    
    ('Admin PC', '192.168.2.50', 'PC', 'OFFLINE', 0, 0, NULL, 0, CURRENT_TIMESTAMP - INTERVAL '1 day', 'Office 204',
     NULL),
    
    -- IoT Devices
    ('Temperature Sensor 01', '192.168.3.10', 'IOT', 'ONLINE', 5.2, 12.5, 25.3, 259200, CURRENT_TIMESTAMP - INTERVAL '2 minutes', 'Floor 1',
     '{"version": "v2c", "community": "public", "port": 161, "timeout": 5000}'::jsonb),
    
    ('Smart Camera 01', '192.168.3.20', 'IOT', 'WARNING', 65.8, 72.3, 58.5, 172800, CURRENT_TIMESTAMP - INTERVAL '20 minutes', 'Floor 2',
     '{"version": "v2c", "community": "private", "port": 161, "timeout": 5000}'::jsonb),
    
    ('IoT Gateway', '192.168.3.1', 'IOT', 'ONLINE', 18.5, 28.7, 38.2, 604800, CURRENT_TIMESTAMP - INTERVAL '1 minute', 'Cloud Zone',
     '{"version": "v3", "port": 161, "username": "iotadmin", "authProtocol": "MD5", "privProtocol": "DES", "timeout": 5000}'::jsonb);

-- Alerts - Critical alerts
INSERT INTO alerts (device_id, device_name, message, severity, timestamp, acknowledged, acknowledged_by) 
SELECT 
    id,
    name,
    'Device is in critical state - immediate attention required',
    'critical',
    CURRENT_TIMESTAMP - INTERVAL '30 minutes',
    FALSE,
    NULL
FROM devices 
WHERE status = 'CRITICAL';

-- Alerts - Warning alerts
INSERT INTO alerts (device_id, device_name, message, severity, timestamp, acknowledged, acknowledged_by) 
SELECT 
    id,
    name,
    CASE 
        WHEN cpu_usage > 90 THEN 'Device performance degraded - CPU usage above 90%'
        WHEN memory_usage > 85 THEN 'High memory usage detected - above 85%'
        WHEN temperature > 70 THEN 'Device temperature is high - above 70°C'
        ELSE 'Device performance warning'
    END,
    'warning',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    FALSE,
    NULL
FROM devices 
WHERE status = 'WARNING' OR cpu_usage > 80 OR memory_usage > 75 OR temperature > 65;

-- Alerts - High CPU usage
INSERT INTO alerts (device_id, device_name, message, severity, timestamp, acknowledged, acknowledged_by) 
SELECT 
    id,
    name,
    'High CPU usage detected - ' || cpu_usage || '%',
    'warning',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    TRUE,
    'admin'
FROM devices 
WHERE cpu_usage > 75 AND status = 'ONLINE'
LIMIT 3;

-- Alerts - High memory usage
INSERT INTO alerts (device_id, device_name, message, severity, timestamp, acknowledged, acknowledged_by) 
SELECT 
    id,
    name,
    'High memory usage detected - ' || memory_usage || '%',
    'warning',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    FALSE,
    NULL
FROM devices 
WHERE memory_usage > 80 AND status = 'ONLINE'
LIMIT 2;

-- Alerts - Offline devices
INSERT INTO alerts (device_id, device_name, message, severity, timestamp, acknowledged) 
SELECT 
    id,
    name,
    'Device went offline unexpectedly',
    'critical',
    CURRENT_TIMESTAMP - INTERVAL '2 hours',
    FALSE
FROM devices 
WHERE status = 'OFFLINE';

-- Alerts - Info alerts (normal status checks)
INSERT INTO alerts (device_id, device_name, message, severity, timestamp, acknowledged) 
SELECT 
    id,
    name,
    'Device status check completed - all systems normal',
    'info',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    TRUE
FROM devices 
WHERE status = 'ONLINE' AND cpu_usage < 50 AND memory_usage < 60
LIMIT 5;

-- Update acknowledged_at for acknowledged alerts
UPDATE alerts 
SET acknowledged_at = timestamp + INTERVAL '1 hour'
WHERE acknowledged = TRUE AND acknowledged_at IS NULL;

-- Comments for documentation
COMMENT ON TABLE devices IS 'Stores network devices monitored by NetSentinel';
COMMENT ON TABLE alerts IS 'Stores alerts and notifications for devices';
COMMENT ON TABLE users IS 'Stores user accounts and their roles';
COMMENT ON COLUMN devices.snmp_config IS 'JSON object containing SNMP configuration: {version, community?, port, username?, authProtocol?, privProtocol?, timeout}';
COMMENT ON COLUMN devices.uptime IS 'Device uptime in seconds';
COMMENT ON COLUMN devices.cpu_usage IS 'CPU usage percentage (0-100)';
COMMENT ON COLUMN devices.memory_usage IS 'Memory usage percentage (0-100)';
COMMENT ON COLUMN users.password IS 'User password (plain text for demo, use bcrypt in production)';
