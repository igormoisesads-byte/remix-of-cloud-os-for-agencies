
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove previous schedule if any
DO $$
BEGIN
  PERFORM cron.unschedule('cloudos-check-ad-balances');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cloudos-check-ad-balances',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--a7d000a7-8b36-403b-b38d-ca4a0e6311f6.lovable.app/api/public/hooks/check-balances',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_ucoxbEtGK5XOmuXxvwnqow_Yz68hL16"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
