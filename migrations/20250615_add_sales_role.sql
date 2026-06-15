-- Migration: Add 'sales' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales';
