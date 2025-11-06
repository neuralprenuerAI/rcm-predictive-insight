-- Add credentials column to api_connections table for storing ECW authentication data
ALTER TABLE public.api_connections 
ADD COLUMN credentials jsonb DEFAULT '{}'::jsonb;