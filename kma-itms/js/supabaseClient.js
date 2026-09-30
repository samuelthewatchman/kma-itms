// The one place we talk to Supabase from. Every other file imports `supabase` from here.
// The anon key is designed to be public (it lives in the browser). Security comes from
// the Row Level Security rules in schema.sql, NOT from hiding this key.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://pahjqfhbpbnmsfspgetl.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhaGpxZmhicGJubXNmc3BnZXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MjM0OTYsImV4cCI6MjEwNTk5OTQ5Nn0.7Y107ytNvo2Nikr8BXaf8eCkQYKb0I5JTXJoKy8UHzg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
