# Daily distress check-in thesis demo

Echo offers an optional Low, Moderate or High self-report on the Dashboard. The app saves one editable response per local calendar day. The journal emotion used for this rule is the dominant text emotion from the saved analysis of a reflection, grouped by when the reflection was written in the account timezone.

The suggestion appears on day three when all three consecutive days have a High response, at least one completed journal emotion result, and only qualifying emotion labels among the saved results for that day. The qualifying labels are sadness, fear, anger, disgust and anxiety. A missing day, lower response, mixed result or disabled in-app notifications prevents the suggestion. The notification is deduplicated, stays in Echo, and offers Chat with Buddy, Write a reflection and Dismiss. Dismiss marks it read.

## Run the demonstration

From the repository root, run:

```powershell
npm exec -w frontend -- playwright test --config playwright.notifications.config.ts --grep "thesis demo" --headed
```

The browser harness advances three fictional dates using the same streak rule as the backend. It shows no notification on days one and two, opens the day-three notification, verifies both destination links, takes a screenshot, and dismisses the notification. It does not use a real account or contact the production database. The screenshot is written to the test output folder under `frontend/e2e/.artifacts/user-notifications/`.

To demonstrate the live feature, open Dashboard → Daily distress check-in. A live account must actually have three matching calendar days. Use the isolated demonstration for the defense when those dates cannot be reproduced on demand.

## Verification

The backend tests cover local date boundaries, missing and mixed results, lower ratings, the fourth day, encrypted saving, notification preferences, duplicate prevention and authenticated routing. A PostgreSQL migration test verifies that ordinary notifications still reach enabled external channels and check-in suggestions stay in the app. The browser test verifies the end-user flow with synthetic records. Use the screenshot as evidence of interface behavior, not as clinical or model-accuracy evidence.
