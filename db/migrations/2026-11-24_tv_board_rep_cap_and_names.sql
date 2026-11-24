-- 1) Maxes, records and trends only count lift sets of 5 reps or fewer (all logs stay in HPD).
-- 2) First names keep their real capitals; only ALL-CAPS (3+ letters) or all-lowercase names are re-cased.
do $mig$
declare
  def text := pg_get_functiondef('public.tv_board(text)'::regprocedure);
  old_reps text := $o$where l.weight_lbs > 0 and l.reps >= 1$o$;
  new_reps text := $n$where l.weight_lbs > 0 and l.reps between 1 and 5$n$;
  old_name text := $o$initcap(trim(split_part(trim(a.name),' ',1)))$o$;
  new_name text := $n$(case when split_part(trim(a.name),' ',1) = lower(split_part(trim(a.name),' ',1))
              or (split_part(trim(a.name),' ',1) = upper(split_part(trim(a.name),' ',1)) and length(split_part(trim(a.name),' ',1)) > 2)
            then initcap(split_part(trim(a.name),' ',1)) else split_part(trim(a.name),' ',1) end)$n$;
begin
  if position(old_reps in def) = 0 or position(old_name in def) = 0 then
    raise exception 'tv_board body not as expected';
  end if;
  def := replace(def, old_reps, new_reps);
  def := replace(def, old_name, new_name);
  execute def;
end
$mig$;
