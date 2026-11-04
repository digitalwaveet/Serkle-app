-- Add database indexes for SOS system performance optimization

-- Index for active SOS alerts by status and creation time
CREATE INDEX IF NOT EXISTS idx_sos_alerts_status_created 
ON sos_alerts(status, created_at DESC) 
WHERE status IN ('active', 'responding');

-- Index for helper responses by alert and status
CREATE INDEX IF NOT EXISTS idx_sos_helpers_alert_status 
ON sos_helpers(alert_id, status) 
WHERE status IN ('responding', 'arrived', 'completed');

-- Index for helper profiles availability and location
CREATE INDEX IF NOT EXISTS idx_helper_profiles_available 
ON helper_profiles(is_available, location_lat, location_lng) 
WHERE is_available = true;

-- Index for SOS messages by alert for faster chat loading
CREATE INDEX IF NOT EXISTS idx_sos_messages_alert 
ON sos_messages(alert_id, created_at);

-- Index for helper user lookups
CREATE INDEX IF NOT EXISTS idx_sos_helpers_user 
ON sos_helpers(helper_user_id, status, completed_at DESC);