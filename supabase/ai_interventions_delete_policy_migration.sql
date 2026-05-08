-- =========================================================================
-- Phlo AI Ops - super-admin DELETE policy on ai_interventions.
--
-- RLS is enabled on public.ai_interventions but only SELECT/INSERT/UPDATE
-- policies existed; with no FOR DELETE policy, every DELETE silently
-- affects 0 rows (Postgres returns OK; PostgREST returns 200 + empty
-- array). The "Delete permanently" button on the intervention detail page
-- looked like it did nothing because of this.
--
-- Restricting hard delete to super_admin matches the JS-layer guard in
-- deleteIntervention(); cascading FKs on intervention_workflows /
-- intervention_metrics / workflow_baselines clean up dependents
-- automatically. Suggestion linkage is detached in the action before the
-- delete so shipped suggestions don't dangle.
--
-- Safe to re-run.
-- =========================================================================

drop policy if exists "delete ai_interventions super" on public.ai_interventions;
create policy "delete ai_interventions super"
  on public.ai_interventions
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.role_grants g
      where g.user_id = auth.uid() and g.role = 'super_admin'
    )
  );

notify pgrst, 'reload schema';
