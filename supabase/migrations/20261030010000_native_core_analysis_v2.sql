-- Preserve historical results; native model categories are not clinical severity.
begin;
alter table ai_analysis.analysis_results alter column severity drop not null;
alter table ai_analysis.analysis_results add constraint native_analysis_has_no_screening
  check (schema_version is distinct from 'echo-journal-analysis-v2' or (severity is null and phq8_score is null));
alter table ai_analysis.analysis_results add constraint legacy_analysis_keeps_severity
  check (schema_version is distinct from 'echo-journal-analysis-v1' or severity is not null);
commit;
