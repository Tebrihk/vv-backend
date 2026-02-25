-- Create refresh_tokens table for JWT token refresh rotation
-- This table stores hashed refresh tokens for secure session management

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) NOT NULL UNIQUE,
    user_address VARCHAR(42) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments to columns
COMMENT ON TABLE refresh_tokens IS 'Stores hashed refresh tokens for JWT token rotation';
COMMENT ON COLUMN refresh_tokens.id IS 'Primary key UUID';
COMMENT ON COLUMN refresh_tokens.token IS 'Hashed refresh token (bcrypt)';
COMMENT ON COLUMN refresh_tokens.user_address IS 'User wallet address';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Token expiration time';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'Whether the token has been revoked';
COMMENT ON COLUMN refresh_tokens.created_at IS 'Token creation timestamp';
COMMENT ON COLUMN refresh_tokens.updated_at IS 'Token last update timestamp';

-- Create indexes for performance
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_address ON refresh_tokens(user_address);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- Create composite index for active tokens lookup
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_address, is_revoked, expires_at) 
WHERE is_revoked = FALSE AND expires_at > CURRENT_TIMESTAMP;
