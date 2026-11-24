-- Combine athlete profiles that share the same full name (e.g. one athlete with a profile per sport).
-- Bests, records and trends use the best mark across all of that athlete's profiles.
-- Each athlete is listed once; `sports` lists every sport on their profiles so the sport filter finds them.
CREATE OR REPLACE FUNCTION public.tv_board(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  result jsonb;
  local_today date := (now() at time zone 'America/Chicago')::date;
  sem_start date;
  sem_label text;
begin
  if p_token is null or not exists (
    select 1 from tv_private.access
    where token_sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if extract(month from local_today) >= 8 then
    sem_start := make_date(extract(year from local_today)::int, 8, 1);
    sem_label := 'Fall ' || extract(year from local_today)::int;
  else
    sem_start := make_date(extract(year from local_today)::int, 1, 1);
    sem_label := 'Spring ' || extract(year from local_today)::int;
  end if;

  with prof as (
    select a.id,
      lower(regexp_replace(trim(a.name), '\s+', ' ', 'g')) as pkey,
      (case when split_part(trim(a.name),' ',1) = lower(split_part(trim(a.name),' ',1))
              or (split_part(trim(a.name),' ',1) = upper(split_part(trim(a.name),' ',1)) and length(split_part(trim(a.name),' ',1)) > 2)
            then initcap(split_part(trim(a.name),' ',1)) else split_part(trim(a.name),' ',1) end)
        || coalesce(' ' || nullif(upper(left(trim(regexp_replace(trim(a.name),'^\S+\s*','')),1)),'') || '.', '') as display,
      nullif(trim(a.sport),'') as sport,
      case
        when a.grade ~* '^(9|9th|freshman)$' then '9th'
        when a.grade ~* '^(10|10th|sophomore)$' then '10th'
        when a.grade ~* '^(11|11th|junior)$' then '11th'
        when a.grade ~* '^(12|12th|senior)$' then '12th'
        else null end as grade,
      nullif(case when a.position like '{%' then (a.position::jsonb ->> 'pos') else trim(a.position) end, '') as position
    from athletes a
    where a.archived_at is null and nullif(trim(a.name), '') is not null
  ),
  ath as (
    select pkey as id,
      min(display) as display,
      string_agg(distinct sport, ' · ') as sport,
      coalesce(array_agg(distinct sport) filter (where sport is not null), '{}') as sports,
      max(grade) as grade,
      min(position) as position
    from prof group by pkey
  ),
  ath_sport as (
    select id, unnest(sports) as sport from ath
  ),
  marks as (
    select l.athlete_id, l.lift_type as metric, 'lb'::text as unit, true as higher,
           round(case when l.reps <= 1 then l.weight_lbs else l.weight_lbs * (1 + l.reps / 30.0) end) as value,
           l.created_at
    from lift_logs l
    where l.weight_lbs > 0 and l.reps between 1 and 5
      and l.lift_type in ('Bench','Squat','Front Squat','Hang Clean','Power Clean','Deadlift')
    union all
    select p.athlete_id,
           case when p.test_type = '10yd_fly' then 'Fly 10'
                when p.test_variant = 'hands_on_hips' then 'Vertical (no arms)'
                else 'Vertical' end,
           case when p.test_type = '10yd_fly' then 's' else 'in' end,
           p.test_type <> '10yd_fly',
           round(p.metric, 2), p.created_at
    from performance_tests p
    where p.metric is not null
      and ((p.test_type = 'vertical_jump' and p.test_variant in ('arm_swing','hands_on_hips'))
        or p.test_type = '10yd_fly')
  ),
  scored as (
    select prof.pkey as athlete_id, m.metric, m.unit, m.higher, m.value, m.created_at,
           case when m.higher then m.value else -m.value end as score
    from marks m join prof on prof.id = m.athlete_id
  ),
  best as (
    select distinct on (athlete_id, metric) athlete_id, metric, unit, higher, value, created_at
    from scored order by athlete_id, metric, score desc, created_at
  ),
  sem_best as (
    select distinct on (athlete_id, metric) athlete_id, metric, unit, higher, value, created_at
    from scored
    where (created_at at time zone 'America/Chicago')::date >= sem_start
    order by athlete_id, metric, score desc, created_at
  ),
  prior as (
    select athlete_id, metric, max(score) as score from scored
    where created_at < now() - interval '7 days' group by 1, 2
  ),
  monthly as (
    select s.metric, ast.sport,
           to_char(date_trunc('month', s.created_at at time zone 'America/Chicago'), 'YYYY-MM') as month,
           s.athlete_id, max(s.score) as score
    from scored s join ath_sport ast on ast.id = s.athlete_id group by 1, 2, 3, 4
  ),
  daily as (
    select athlete_id, metric, bool_and(higher) as higher, min(unit) as unit,
           (created_at at time zone 'America/Chicago')::date as day, max(score) as score
    from scored
    where (created_at at time zone 'America/Chicago')::date >= sem_start
    group by athlete_id, metric, day
  ),
  span as (
    select athlete_id, metric, min(day) as first_day, max(day) as last_day from daily group by 1, 2
  ),
  per_athlete as (
    select d.athlete_id, d.metric, bool_and(d.higher) as higher, min(d.unit) as unit,
           s.last_day - s.first_day as days,
           max(d.score) filter (where d.day < s.first_day + 14) as first_score,
           max(d.score) filter (where d.day > s.last_day - 30) as last_score
    from daily d join span s using (athlete_id, metric)
    group by d.athlete_id, d.metric, s.first_day, s.last_day
  ),
  gains as (
    select m.metric, ast.sport, min(m.unit) as unit, bool_and(m.higher) as higher, count(*) as n,
           avg(abs(m.first_score)) as base_avg, avg(abs(m.last_score)) as recent_avg,
           avg(m.last_score - m.first_score) as improvement,
           avg((m.last_score - m.first_score) / nullif(abs(m.first_score), 0)) as improvement_pct
    from per_athlete m join ath_sport ast on ast.id = m.athlete_id
    where m.days >= 28
    group by 1, 2
  )
  select jsonb_build_object(
    'generated_at', now(),
    'semester', sem_label,
    'semester_start', sem_start,
    'bests', coalesce((select jsonb_agg(jsonb_build_object(
        'name', ath.display, 'sport', ath.sport, 'sports', to_jsonb(ath.sports),
        'grade', ath.grade, 'position', ath.position,
        'metric', b.metric, 'unit', b.unit, 'higher', b.higher, 'value', b.value,
        'date', (b.created_at at time zone 'America/Chicago')::date,
        'pr_this_week', b.created_at >= now() - interval '7 days',
        'previous', case when p.score is null then null when b.higher then p.score else -p.score end
      ) order by b.metric, case when b.higher then -b.value else b.value end)
      from best b join ath on ath.id = b.athlete_id
      left join prior p on p.athlete_id = b.athlete_id and p.metric = b.metric), '[]'::jsonb),
    'semester_bests', coalesce((select jsonb_agg(jsonb_build_object(
        'name', ath.display, 'sport', ath.sport, 'sports', to_jsonb(ath.sports),
        'metric', b.metric, 'unit', b.unit, 'higher', b.higher,
        'value', b.value, 'date', (b.created_at at time zone 'America/Chicago')::date)
      order by b.metric, case when b.higher then -b.value else b.value end)
      from sem_best b join ath on ath.id = b.athlete_id), '[]'::jsonb),
    'trends', coalesce((select jsonb_agg(jsonb_build_object(
        'metric', metric, 'sport', sport, 'month', month, 'athletes', n,
        'avg', round(abs(avg_score), 1)) order by metric, sport, month)
      from (select metric, sport, month, count(*) n, avg(score) avg_score from monthly group by 1, 2, 3) t), '[]'::jsonb),
    'gains', coalesce((select jsonb_agg(jsonb_build_object(
        'metric', metric, 'sport', sport, 'unit', unit, 'higher', higher, 'athletes', n,
        'base_avg', round(base_avg, 2), 'recent_avg', round(recent_avg, 2),
        'improvement', round(improvement, 2), 'improvement_pct', round(improvement_pct * 100, 1))
        order by sport, metric)
      from gains), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;
