alter table public.vladislav_settings
  add column if not exists services_config jsonb
  check (services_config is null or jsonb_typeof(services_config) = 'object');

notify pgrst, 'reload schema';
