ALTER TABLE public.valuations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.valuations ADD COLUMN IF NOT EXISTS guest_token_hash text;
CREATE INDEX IF NOT EXISTS valuations_guest_token_hash_idx ON public.valuations (guest_token_hash) WHERE user_id IS NULL;