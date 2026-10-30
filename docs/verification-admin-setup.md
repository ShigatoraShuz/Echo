# ECHO administrator setup and verification review

## Document scanning required for review

The backend quarantines identity documents unless a trusted scanner is configured. The scanner is a separate service; setting these variables does not install or operate one. Configure `VERIFICATION_SCANNER_URL` and `VERIFICATION_SCANNER_TOKEN` together in the backend environment. Use HTTPS, or loopback HTTP for a local scanner. Keep the token server-side.

The scanner endpoint accepts a `POST` containing the raw JPG, PNG, or PDF bytes with the matching `Content-Type` and `Authorization: Bearer <token>`. It must perform malware and active-content checks, decode the document, and return JSON containing `status` (`clean`, `rejected`, or `quarantined`), lowercase hex `sha256`, and a nonempty `scannerVersion`. Clean PDFs also require `pages` (1–20); clean images require positive `width` and `height` with at most 40 million pixels. ECHO independently checks the SHA-256 digest and metadata before recording a clean scan. Scanner errors, timeouts, or incomplete results remain quarantined.

For this Windows development machine only, set `VERIFICATION_SCANNER_MODE=windows_defender` and `VERIFICATION_PDFINFO_PATH` to the absolute path of Poppler's `pdfinfo.exe` in `backend/.env`. This opt-in scans a temporary private copy with Microsoft Defender using `-DisableRemediation`, checks the original digest, decodes images with Sharp, and checks PDF page count, encryption, forms, JavaScript, and common active-action markers with Poppler. It quarantines files when any check or cleanup fails. This local adapter is blocked in production; a deployed backend needs the approved HTTPS scanner above. Restart the backend after changing its environment.

New uploads are scanned at upload time. A draft with quarantined files can retry submission after the scanner is available; the backend rescans its stored files. When an administrator selects an existing submitted application with quarantined documents, the review page runs one authorized rescan automatically and offers **Run security scan** to retry if it fails. This action requires reviewer MFA and recent authentication, checks stored-file integrity, and opens the evidence only after every document passes. No reviewer can approve quarantined evidence. Do not change a document's scan fields manually.

## Scope

The admin workspace is at `/admin/verifications` (`/admin` redirects there). It uses ECHO's existing cream/green theme and server-enforced verification reviewer role. `admin:super` is the operator-friendly command alias for this scoped administrator account; it does not create an unrestricted database superuser, grant access to private journals/passwords, or introduce a separate hierarchy of staff roles.

No account or live verification decision was created or changed during this implementation. The owner must specify the exact email before provisioning. Prefer a separate reviewer identity: administrators cannot claim or decide their own verification application.

## Provision securely

Use a real ECHO account that its owner has registered and email-verified through the normal signup flow. Complete required onboarding and policy review. Google sign-in is supported. Do not invent an email, use a shared default password, auto-confirm an unknown identity, disable signup protections, or put service-role credentials in the frontend.

From `backend`, with its existing server-only `.env` configured:

```text
npm run admin:super -- reviewer@example.com --check
npm run admin:super -- reviewer@example.com --grant
npm run admin:super -- reviewer@example.com --check
```

Replace the example with the explicitly selected account. `--check` is the read-only default. Granting is idempotent and requires a verified email; the script verifies the resulting role. It never accepts, prints, creates, or changes a password. If no account exists, finish the normal account-registration flow first.

The previous setup script wrote to `public.verification_admins` and included a timestamp column absent from the current table. The corrected script targets the canonical `verification_service.verification_admins`, which is what Express checks. No new migration is required for this existing role table.

To revoke only this account's review privileges:

```text
npm run admin:super -- reviewer@example.com --revoke
```

This is a remote role mutation when the backend environment targets remote Supabase; execute only for an explicitly authorized email and project. It is not an account deletion. The command is a trusted server/operator operation, never an endpoint available to ordinary users.

## Use the workspace

1. Sign in as the designated reviewer at `/admin-login`, also linked below the regular signup form as **Sign as an admin**. This separate page authenticates existing accounts, checks reviewer access through Express, and opens `/admin/verifications`. It does not offer public administrator registration or grant roles. Age, policy, and onboarding gates still apply. The regular `/login?next=%2Fadmin%2Fverifications` path continues to work.
2. Open the direct workspace URL, or open the profile menu and choose **Admin verification reviews**. That link is shown only after a server permission check.
3. Choose an application. The queue does not fetch/decrypt every applicant's details automatically.
4. Open and inspect the required evidence. Signed links expire after five minutes; refresh and reopen the application for fresh links.
5. Select **Start review**, then **Approve**, **Request changes**, or **Reject**.
6. Add a reason and helpful note for changes/rejection. Do not repeat private document numbers in notes.
7. Acknowledge that you reviewed the evidence, select **Review decision**, and confirm the named applicant and decision.

Approval fulfills the verification requirement only. Global consent, per-entry requests, eligibility, current policies, and provider availability remain separate. Approval does not enable analysis consent or imply a real model is running.

## Safeguards and validation

- Express checks the canonical active administrator record on list/detail/claim/decision operations; browser visibility never grants permission.
- Ordinary users are rejected before private application data is loaded.
- Admin responses are marked `Cache-Control: no-store`.
- Self-review and decisions outside `under_review` are rejected. Approval requires readable application data and the required evidence records.
- Existing review audit and notification handling is preserved.
- Selection changes clear prior details/confirmation; delayed responses cannot replace the current selection. Busy controls prevent changing the applicant during a decision.
- No live applications were used for browser QA. `artifacts/admin-review-20260831/review-confirmation.png` contains synthetic information only. The temporary fixture route was removed.

The full suites passed with 306 frontend and 159 backend tests after these changes. New coverage includes role provisioning/revocation, non-admin rejection, self-approval prevention, missing evidence, decision states, explicit confirmation, stale details, and request failures. Both type checks and the backend build passed. Targeted lint has no errors; the profile menu retains two pre-existing image-related warnings. Full frontend lint has an unrelated existing error in `buddy-view.test.tsx`.

The final frontend production build also passed after removing the synthetic preview route; only the real `/admin` and `/admin/verifications` routes remain.
