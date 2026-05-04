-- =========================================================================
-- Phlo AI Ops - sample data
-- Run AFTER all migration files. Re-runnable: every insert is guarded.
-- Lets you see the /workflows table and /map populated end-to-end before
-- any real users have signed up.
-- =========================================================================

-- 1. Workflows -------------------------------------------------------------
with seed(name, team, regulatory, frequency_per_week, criticality_score, business_kpi, owner_names) as (
  values
    ('Weekly stock count',          'Operations',       false, 1::numeric,    3, 'Stock accuracy',         array['Alex Rivera','Sara Chen']),
    ('Order packing audit',         'Operations',       false, 5::numeric,    2, 'Order accuracy',         array['Alex Rivera']),
    ('Daily exception report',      'Operations',       false, 7::numeric,    4, 'Exceptions resolved',    array['Sara Chen']),
    ('Quarterly compliance audit',  'Operations',       true,  0.08::numeric, 5, 'Audit findings',         array['Alex Rivera','Sara Chen','Lina Volkova']),
    ('Refund approval',             'Customer Success', true,  5::numeric,    4, 'Refund TAT',             array['Priya Patel','Tom Hayward']),
    ('Onboarding email follow-up',  'Customer Success', false, 7::numeric,    2, 'Activation rate',        array['Priya Patel']),
    ('VIP customer call review',    'Customer Success', false, 2::numeric,    3, 'CSAT',                   array['Tom Hayward','Marcus Boateng']),
    ('Customer NPS survey send',    'Customer Success', false, 1::numeric,    1, 'NPS responses',          array['Marcus Boateng']),
    ('Monthly close',               'Finance',          true,  0.25::numeric, 5, 'Days to close',          array['Lina Volkova','Yusuf Aydin']),
    ('AP invoice processing',       'Finance',          true,  5::numeric,    4, 'Cost per invoice',       array['Yusuf Aydin','Hannah Ng']),
    ('Vendor reconciliation',       'Finance',          false, 1::numeric,    3, 'Reconciliation breaks',  array['Lina Volkova']),
    ('Weekly forecast update',      'Finance',          false, 1::numeric,    4, 'Forecast accuracy',      array['Hannah Ng'])
)
insert into public.workflows
  (name, team, regulatory, frequency_per_week, criticality_score, business_kpi, owner_names, active)
select s.name, s.team, s.regulatory, s.frequency_per_week, s.criticality_score, s.business_kpi, s.owner_names, true
from seed s
where not exists (select 1 from public.workflows w where w.name = s.name);

-- 2. AI interventions ------------------------------------------------------
insert into public.ai_interventions (name, description, status)
select v.name, v.description, v.status
from (values
  ('Refund triage agent',    'Auto-categorises refund requests by reason code so humans only see edge cases.',   'active'),
  ('Invoice extraction',     'OCR + LLM extraction of AP invoice header + line items into the ERP.',             'active'),
  ('Stock count vision',     'Phone camera counts stock and flags variance against the system count.',           'paused'),
  ('Forecast assistant',     'Drafts the weekly forecast narrative from the underlying numbers.',                'active'),
  ('NPS reply drafter',      'Drafts personalised replies to NPS detractors for human review.',                  'paused')
) as v(name, description, status)
where not exists (select 1 from public.ai_interventions a where a.name = v.name);

-- 3. Link interventions ↔ workflows ---------------------------------------
insert into public.intervention_workflows (intervention_id, workflow_id)
select i.id, w.id
from public.ai_interventions i
join public.workflows w on (
  (i.name = 'Refund triage agent'   and w.name = 'Refund approval') or
  (i.name = 'Invoice extraction'    and w.name = 'AP invoice processing') or
  (i.name = 'Stock count vision'    and w.name = 'Weekly stock count') or
  (i.name = 'Forecast assistant'    and w.name = 'Weekly forecast update') or
  (i.name = 'NPS reply drafter'     and w.name = 'Customer NPS survey send')
)
on conflict do nothing;

-- 4. 12 weeks of metrics history per workflow -----------------------------
-- Cost/time/errors trend down (improvement). Revenue trends up. People is flat.
do $$
declare
  w           record;
  weeks       constant int := 12;
  i           int;
  t           int;        -- 0 = oldest snapshot, weeks-1 = current
  bt numeric; bc numeric; bp numeric; be numeric; br numeric;
  d           date;
begin
  for w in select id from public.workflows loop
    bt := 30  + (random() * 90);    -- minutes
    bc := 50  + (random() * 200);   -- $ per run
    bp := 1   + floor(random() * 3);
    be := 1   + floor(random() * 5);
    br := 1000 + (random() * 5000);

    for i in 0..weeks-1 loop
      d := current_date - (i * 7);
      t := weeks - 1 - i;

      insert into public.workflow_metrics_history (workflow_id, snapshot_date, metric, value)
      values
        (w.id, d, 'time',    round((bt * (1 - 0.02 * t))::numeric, 2)),
        (w.id, d, 'cost',    round((bc * (1 - 0.02 * t))::numeric, 2)),
        (w.id, d, 'people',  bp),
        (w.id, d, 'errors',  round(greatest(0, be * (1 - 0.04 * t))::numeric, 2)),
        (w.id, d, 'revenue', round((br * (1 + 0.02 * t))::numeric, 2))
      on conflict (workflow_id, snapshot_date, metric) do nothing;
    end loop;
  end loop;
end $$;

-- 5. workflow_metrics (one-row baseline/current view) --------------------
-- Mirror the latest + oldest rows from history into the existing
-- workflow_metrics table so the rest of the app stays consistent.
insert into public.workflow_metrics
  (workflow_id, time_baseline, time_current, cost_baseline, cost_current,
   people_baseline, people_current, errors_baseline, errors_current,
   revenue_baseline, revenue_current)
select
  w.id,
  max(case when h.metric = 'time'    and h.snapshot_date = (select min(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'time'    and h.snapshot_date = (select max(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'cost'    and h.snapshot_date = (select min(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'cost'    and h.snapshot_date = (select max(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'people'  and h.snapshot_date = (select min(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'people'  and h.snapshot_date = (select max(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'errors'  and h.snapshot_date = (select min(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'errors'  and h.snapshot_date = (select max(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'revenue' and h.snapshot_date = (select min(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end),
  max(case when h.metric = 'revenue' and h.snapshot_date = (select max(snapshot_date) from public.workflow_metrics_history where workflow_id = w.id) then h.value end)
from public.workflows w
join public.workflow_metrics_history h on h.workflow_id = w.id
group by w.id
on conflict (workflow_id) do nothing;
