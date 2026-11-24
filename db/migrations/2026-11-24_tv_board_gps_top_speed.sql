-- Adds Titan GPS top speed (gps_sessions.top_speed_mph) as the metric 'Top Speed' (unit mph, higher is better).
-- It joins the other marks, so bests, semester bests, weekly PRs and improvers all include it.
-- A session has only a date, so it counts as noon Central on that day. Read-only, like the rest of tv_board.
do $mig$
declare
  def text := pg_get_functiondef('public.tv_board(text)'::regprocedure);
  anchor text := $a$        or p.test_type = '10yd_fly')
  ),
  scored as ($a$;
  addition text := $n$        or p.test_type = '10yd_fly')
    union all
    select g.athlete_id, 'Top Speed', 'mph', true, round(g.top_speed_mph, 2),
           (g.session_date + time '12:00') at time zone 'America/Chicago'
    from gps_sessions g
    where g.top_speed_mph > 0 and g.session_date is not null
  ),
  scored as ($n$;
begin
  if position(anchor in def) = 0 or position('gps_sessions' in def) > 0 then
    raise exception 'tv_board body not as expected';
  end if;
  execute replace(def, anchor, addition);
end
$mig$;
