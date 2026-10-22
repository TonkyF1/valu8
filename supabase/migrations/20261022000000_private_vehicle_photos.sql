-- Ensure vehicle photos are never publicly readable. The original migration
-- created the bucket with public = true; owner-only RLS policies don't stop
-- access via /object/public/ URLs while the bucket flag is true.
UPDATE storage.buckets SET public = false WHERE id = 'vehicle-photos';
