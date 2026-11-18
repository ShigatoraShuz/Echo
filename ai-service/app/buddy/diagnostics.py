"""Allowlisted metadata only: never serialize generated drafts or user input."""
ISSUES = frozenset('empty hard_token_limit persistent_distress_support_missing generic_advice_without_starting_action stock_reassurance stacked_generic_advice dangling_list_or_clause unfinished_structure_or_clause excessive_questions_4plus extreme_response_length extreme_structural_overload persistent_advice_without_concrete_start requested_step_list_missing requested_step_count_mismatch nonconsecutive_step_numbering excessive_step_count incomplete_list_item duplicate_list_item near_verbatim_user_copy malformed_discourse_transition auto_format_failed explicit_urgent ambiguous_unqualified rewrite_context_modified_or_invalid'.split())
ISSUES = ISSUES | {'potential_safety_language_requires_Echo_support_routing', 'unqualified_give_up_requires_human_safety_review'}


def codes(value):
    return list(dict.fromkeys(item for item in value if isinstance(item, str) and item in ISSUES)) if isinstance(value, list) else []


def diagnostics(result):
    attempts=result.get('attempts', 0)
    return {'blockingIssues': codes(result.get('blocking_issues', result.get('issues', []))),
            'advisoryIssues': codes(result.get('advisory_issues', [])),
            'attempts': attempts if type(attempts) is int and 0 <= attempts <= 2 else 0,
            'attemptDiagnostics': [
                {'blockingIssues': codes(row.get('blockingIssues')), 'advisoryIssues': codes(row.get('advisoryIssues'))}
                for row in result.get('attempt_diagnostics', [])[:2] if isinstance(row, dict)]}
