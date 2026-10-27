# Lovable Prompt D — report & follow-up emails via Resend

Sent to Lovable project 101f88bb-9f15-4d61-bcf3-d147a9f39355 on 2026-10-27 (approved by Tony).
Sender domain notify.valu8.uk verified in Resend. Root valu8.uk mail (Squarespace forwarding / Mailgun MX) untouched.

---

Valu8: turn on report and follow-up emails via Resend. Add a secret RESEND_API_KEY and ask me for it. Send from 'Valu8 <reports@notify.valu8.uk>' with reply-to hello@valu8.uk. Don't touch pricing logic, engineVersion, PREMIUM_ENFORCED, deno.lock or Stripe code.

1. Report-ready email to signed-in users when a valuation or advert check completes; max one per report (logged, idempotent). Subject 'Your Valu8 report for {reg or make model} is ready', with private price + range and a button back to the report.
2. Follow-up emails using the existing email_followups table, only to accounts with marketing_opt_in or guests with a consent row. 7 days after a report: advert checks 'Did you buy it? What did you pay?'; own-car valuations 'Did you sell or part-ex it? What did you get?'. Buttons open the existing outcome cards. Re-ask after 14 days if 'still looking', max 3. Daily scheduled job.
3. One-click unsubscribe link in every email (signed token, works without login) plus a simple /unsubscribe page; covers accounts and guest emails.
4. De-duplicate and rate-limit guest consent sign-ups (one row per email, upsert).
5. Test by sending one report email to the test account, delete test rows, report back.
