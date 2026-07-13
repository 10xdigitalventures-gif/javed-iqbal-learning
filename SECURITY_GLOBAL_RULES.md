# SECURITY_GLOBAL_RULES

Reusable security baseline derived from **AI APP BUILDER PROMPTS: 5 Security Checks Before You Launch Your App** (MAYANK SHAH, v1.1), adapted for this platform and future projects.

## 1) Secret leak prevention

- Never hardcode API keys, DB URLs, OAuth secrets, signing secrets, or private credentials in source files.
- Keep secrets only in environment variables or approved secret stores.
- Never expose sensitive secrets via `NEXT_PUBLIC_` / client-side env names.
- `.env` files must stay ignored by git, while `.env.example` documents required keys without real values.
- Logs, error handlers, and mock/dev fallbacks must never print live secrets or full credential payloads.
- If a secret was ever committed, rotate it even after removal because Git history may still contain it.

## 2) Personal data flow rules

- Track every path for email, phone, password, payment metadata, IP address, and uploaded files.
- Avoid storing PII in browser localStorage; prefer server-side sessions or HttpOnly cookies for auth state.
- Passwords must always be hashed with bcrypt/argon2/scrypt and never stored or logged in plaintext.
- API responses must return only the fields the caller truly needs.
- Third-party integrations must receive the minimum necessary personal data.
- Mock/dev logging must redact recipients, message bodies, tokens, and sensitive payloads.
- A basic account deletion or anonymization flow must exist.

## 3) Pre-deploy production audit

- Production boot must fail when critical env vars are missing.
- Remove or disable debug-only code, test credentials, and unsafe mock behavior before release.
- Error responses must stay generic and avoid leaking stack traces or infrastructure details.
- Enforce security headers including `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, HSTS, and CSP where applicable.
- Restrict CORS to explicit trusted origins.
- Apply rate limiting to login, signup, OTP, password reset, and similar abuse-prone endpoints.
- Verify DB/network transport uses TLS/SSL in deployment.

## 4) Deep logic audit

- Check auth flows for IDOR, broken role checks, insecure JWT handling, and reset-token abuse.
- Never trust client-side price, discount, or entitlement calculations.
- Webhooks must validate signatures before granting access or marking payments paid.
- Use parameterized DB access and avoid raw unsafe SQL.
- Sanitize or safely render any user-controlled rich text/HTML.
- Secure uploads with explicit MIME allowlists, size limits, ownership checks, and private delivery.

## 5) Attacker-perspective review

- Attempt access by changing IDs, slugs, tenant IDs, and object keys.
- Test malformed/expired tokens and role escalation attempts.
- Test spam/abuse paths like signup floods, OTP floods, upload/storage abuse, and repeated webhook hits.
- Check for exposed internal pages, docs, `.env`, `.git`, local admin tools, or debug endpoints.
- Review business logic for negative totals, duplicate fulfillment, repeated coupon stacking, or replay issues.
- Re-run this attacker review after every major release.

## Platform-specific implementation notes

- Multi-tenant routes must verify both **role** and **tenant ownership**.
- Media signing/share flows must check whether the caller owns the asset or has a valid entitlement path.
- Marketing integrations (LeadConnector / GHL / mail / SMS) must be audited for minimum necessary data sharing.
- Admin audit logs should capture who changed what, but must not store secrets or raw credentials.
