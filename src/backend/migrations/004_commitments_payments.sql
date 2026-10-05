-- Commitments and Payments Schema

CREATE TABLE income_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL
);

CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL
);

-- Note: Transactions table already exists in 001_initial_schema.sql
-- We need to ensure it links correctly to these new master data tables.
-- The existing table uses VARCHAR for method/source, which is sub-optimal.
-- Updating the schema to use Foreign Keys for these.

ALTER TABLE transactions ADD COLUMN income_source_id UUID REFERENCES income_sources(id);
ALTER TABLE transactions ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id);

-- Migration of existing data should be planned in a real system.
