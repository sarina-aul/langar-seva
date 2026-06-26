-- Prevent inflated public intake requests: a single household request cannot ask
-- for more meals than the household size entered on the form.

alter table public.recipients
  add constraint recipients_meals_lte_household_size
  check (meals <= household_size);
