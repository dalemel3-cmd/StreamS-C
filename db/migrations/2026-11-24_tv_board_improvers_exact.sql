-- 1) Lift maxes come back exact (2 decimals) instead of whole pounds. The HPD app (v5.16.5) ranks
--    on the exact estimate and shows it to the nearest 5 lb; the TV now does that rounding on screen.
-- 2) Adds `improvers`: each athlete's own semester change per metric (Most Improved board).
--    Same window as Season Trends: max in their first 14 days of the semester vs max over their
--    last 30 days of logging, athletes whose marks span 28+ days. Lifts use sets of 5 reps or fewer.
do $mig$
declare
  def text := pg_get_functiondef('public.tv_board(text)'::regprocedure);
  old_val text := $o$round(case when l.reps <= 1 then l.weight_lbs else l.weight_lbs * (1 + l.reps / 30.0) end) as value$o$;
  new_val text := $n$round(case when l.reps <= 1 then l.weight_lbs else l.weight_lbs * (1 + l.reps / 30.0) end, 2) as value$n$;
  anchor text := $a$    'gains', coalesce($a$;
  addition text := $n$    'improvers', coalesce((select jsonb_agg(jsonb_build_object(
        'name', ath.display, 'sport', ath.sport, 'sports', to_jsonb(ath.sports),
        'metric', m.metric, 'unit', m.unit, 'higher', m.higher,
        'start', abs(m.first_score), 'now', abs(m.last_score), 'days', m.days))
      from per_athlete m join ath on ath.id = m.athlete_id
      where m.days >= 28 and m.first_score is not null and m.last_score is not null), '[]'::jsonb),
$n$;
begin
  if position(old_val in def) = 0 or position(anchor in def) = 0
     or position($q$'improvers'$q$ in def) > 0 then
    raise exception 'tv_board body not as expected';
  end if;
  def := replace(def, old_val, new_val);
  def := replace(def, anchor, addition || anchor);
  execute def;
end
$mig$;
