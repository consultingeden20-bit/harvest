-- Roles and Permissions Schema
-- Permissions: View/Edit Harvest Data, Manage Users, Manage Config

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'MANAGE_USERS', 'RECORD_PAYMENT', 'VIEW_REPORTS'
    description TEXT
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- Group scopes for authorities
CREATE TABLE group_authorities (
    user_id UUID REFERENCES users(id),
    group_id UUID REFERENCES groups(id),
    PRIMARY KEY (user_id, group_id)
);
