-- Kelyo database initialization
-- Runs once on first Postgres startup

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Test database for running automated tests
CREATE DATABASE kelyo_test;
GRANT ALL PRIVILEGES ON DATABASE kelyo_test TO kelyo;
