-- Final Schema Additions

CREATE TABLE reconciliation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES harvest_sessions(id),
    physical_count NUMERIC(19, 4) NOT NULL,
    system_total NUMERIC(19, 4) NOT NULL,
    discrepancy NUMERIC(19, 4) GENERATED ALWAYS AS (physical_count - system_total) STORED,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    operator_id UUID REFERENCES users(id)
);

CREATE TABLE synchronization_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    last_sync_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50),
    uploaded_count INTEGER,
    downloaded_count INTEGER
);
