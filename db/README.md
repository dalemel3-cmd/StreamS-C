# HPD board database changes

`public.tv_board(token)` lives in the HPD Supabase project and is changed only through migrations.
Files here are applied with the Supabase migration tool **after** the matching PR is approved and merged.
They never write to HPD tables.
