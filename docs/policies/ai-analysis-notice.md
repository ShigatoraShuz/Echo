## At a glance

AI-assisted journal analysis is optional. ECHO supports reflection and wellbeing; it is not a medical service, diagnostic tool, or emergency monitoring system. Read this notice with the Privacy Notice and Terms of Use. The displayed version identifies your acknowledgement.

## Separate choices

Reading or acknowledging this notice does not enable analysis. Processing requires active account-level journal-analysis consent, consent saved with the selected journal, and an explicit analysis request. The account must also pass current access and identity-verification checks.

You can leave analysis off during registration and change the optional permission in Settings. Enabling it does not automatically process earlier journals. Turning it off does not delete existing results or guarantee cancellation of an already-running request.

## Actual processing path

The browser requests analysis through the API Gateway. Analysis Service checks User Service authorization, obtains the selected journal text and consent from Journal Service, calls self-hosted ML inference, and asks Recommendation Service for structured next steps.

Journal text is decrypted for this requested processing. Recommendation Service receives severity and an urgent-language flag rather than journal text. There is no supported facial analysis, camera capture, MediaPipe processing, external job-claim worker, or automatic trusted-contact notification in this architecture.

## Availability and failure

Validated model artifacts are required separately. A live service health check does not mean inference is ready. When artifacts are unavailable, readiness and inference report controlled unavailability. Production never substitutes simulated scores.

The API records processing, completed, or failed analysis status. Network and dependency failures can prevent completion. A failed analysis does not remove the saved journal. You may retry later; an onscreen waiting indicator is not a result.

## Limits of results

The model estimates a PHQ-8-style screening score and severity from writing and may flag urgent language. These are not answers you personally supplied to a PHQ-8 questionnaire, clinical findings, diagnoses, or predictions of safety. AI can misinterpret context, language, irony, or missing information. A low score does not establish that someone is safe.

Recommendation Service provides optional reflective activities and support information, not individualized treatment. You may disregard a suggestion or stop using analysis. Discuss concerns with a qualified professional.

## Safety and your control

ECHO does not guarantee identification of danger, human review, emergency dispatch, or a response time. Do not wait for an analysis if you need help now; contact local emergency services or someone you trust directly.

Saved results and deletion are described in the Privacy Notice. For questions about model validation or deployment-specific data handling, ask the operator before enabling analysis. No clinical approval or guaranteed model accuracy is claimed.
