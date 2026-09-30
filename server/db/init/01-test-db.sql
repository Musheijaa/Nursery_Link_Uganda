-- Separate database for the automated test suite so tests never touch dev data
CREATE DATABASE nurserylink_test OWNER nurserylink;
\c nurserylink_test
CREATE EXTENSION IF NOT EXISTS postgis;
\c nurserylink
CREATE EXTENSION IF NOT EXISTS postgis;
