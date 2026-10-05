-- Harvest Configuration Schema
CREATE TABLE harvest_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    harvest_id UUID REFERENCES harvests(id),
    name VARCHAR(100) NOT NULL
);

CREATE TABLE commitment_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contributor_id UUID REFERENCES contributors(id),
    harvest_id UUID REFERENCES harvests(id),
    amount NUMERIC(19, 4) NOT NULL
);
