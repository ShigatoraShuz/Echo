# User professional-support workspace plan

## Goal and boundaries

Give the signed-in user one coherent place to find reviewed care, follow requests, read and send private case messages, manage appointments, and revisit closed support. Keep the professional workspace and its permissions unchanged. The reference screenshot supplies layout direction, not example people, appointments, or messages for production.

## Existing contracts to reuse

| Section            | Live source                                          | User action                                                                             |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Overview           | `GET /professional/hub`, own requests, case messages | Open active case, next appointment, message thread, directory, requests                 |
| Find Professionals | Directory and organization endpoints                 | Search/filter, review credentials, start a support request                              |
| My Requests        | Own requests and case detail                         | See every supported status, withdraw, control sharing, review timeline                  |
| Messages           | Case messages and read-state endpoints               | Select a case, page history, send encrypted text in active assigned cases               |
| Appointments       | Own appointments endpoint                            | Accept/decline offers, request a change, cancel confirmed appointments                  |
| Support History    | Own requests, case detail/timeline                   | Review closed, declined, and withdrawn cases, consultations, referrals, follow-up notes |

## Implementation sequence

1. Build a compact shared section navigation and widen only the user support routes. Preserve space when the expanding app sidebar opens. Respect the current theme and motion preference.
2. Recompose the overview into a modest banner, live support/appointment/request/message cards, quick actions, privacy, and immediate-help access. Every card needs an honest empty state and a working destination.
3. Add dedicated Messages and Support History routes backed by the existing private APIs. Reuse case ownership checks and the existing message/sharing model. Keep sending disabled when a case is read-only.
4. Tighten the directory, request, and appointment presentation without changing their established backend actions. Keep loading, failure, and empty states.
5. Test route navigation, active/empty states, message sending and history, appointment actions, responsive layout, reduced motion, typecheck, lint, and build.

## Contract limits and safety

- Case messages currently support encrypted text only. Journal and PHQ-8 references are shared through explicit case-scoped consent, not embedded in message bodies. Arbitrary file attachments require a private attachment storage contract, malware/type/size validation, retention rules, and professional-side rendering; do not show a nonfunctional upload control.
- A request for a particular practitioner remains a preference until the organization assigns them. Do not show sample clinicians or invented recommendations.
- The existing own-requests endpoint is capped at 50 records. The history view must state this limit until cursor pagination is available.
- Support messaging is asynchronous and cannot replace immediate help. Keep urgent-help links prominent and stable.
