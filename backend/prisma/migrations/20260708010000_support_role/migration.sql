-- New admin-portal staff role for support agents (limited by per-user scopes).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPPORT';
