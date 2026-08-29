-- Correct the seed formatting by publishing new immutable versions. Historical
-- versions and any consent references remain untouched.
with inserted as (
  insert into auth_provisioning.policy_documents
    (document_type, version, title, summary, sanitized_markdown, content_sha256, effective_at)
  values
    (
      'terms_of_use', '2026-08-29.1', 'Terms of Use',
      'How to use ECHO safely and responsibly.',
      E'## Purpose\n\nECHO is a private reflection and wellbeing support tool.\n\n## Not medical care\n\nECHO is not diagnosis, treatment, emergency monitoring, or a substitute for professional care.\n\n## Your responsibilities\n\nKeep your account secure and use ECHO lawfully.',
      encode(extensions.digest(E'terms-2026-08-29.1', 'sha256'), 'hex'),
      '2026-08-29T00:00:00Z'
    ),
    (
      'privacy_notice', '2026-08-29.1', 'Privacy Notice',
      'What ECHO stores and the controls available to you.',
      E'## Information ECHO uses\n\nECHO stores account data, settings, and reflections needed to provide the service.\n\n## Private reflections\n\nJournal content is treated as sensitive private data.\n\n## Your controls\n\nYou can change optional permissions and request export or deletion.',
      encode(extensions.digest(E'privacy-2026-08-29.1', 'sha256'), 'hex'),
      '2026-08-29T00:00:00Z'
    ),
    (
      'ai_analysis_notice', '2026-08-29.1', 'AI Analysis Notice',
      'How optional local AI reflection works and where its limits are.',
      E'## Optional analysis\n\nECHO uses a locally hosted language model only for entries you explicitly choose to analyze.\n\n## Limitations\n\nAI output may be incomplete or incorrect and is not clinical or emergency guidance.\n\n## Your choice\n\nDeclining optional AI analysis does not prevent account creation or normal journaling.',
      encode(extensions.digest(E'ai-2026-08-29.1', 'sha256'), 'hex'),
      '2026-08-29T00:00:00Z'
    )
  returning id, document_type
)
select auth_provisioning.activate_policy_set(
  (array_agg(id) filter (where document_type = 'terms_of_use'))[1],
  (array_agg(id) filter (where document_type = 'privacy_notice'))[1],
  (array_agg(id) filter (where document_type = 'ai_analysis_notice'))[1]
) from inserted;
