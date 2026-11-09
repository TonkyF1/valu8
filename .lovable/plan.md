# Registration lookup failure — diagnosis (no changes made)

## Findings from lookup-vehicle logs
The logs I can read only go back to about 09:23 UTC today (9 Nov). Nothing older than that came back, so I can't confirm when the failures started from logs alone.

1. **VDG (Vehicle Data Global)**: HTTP 200 every time, but the response body carries an error code:
   - `StatusCode 6 — SandboxValidationFailure` for BD67USJ and T10NKF (09:23:22, 09:26:06, 09:26:11).
   - `StatusCode 13 — InvalidSearchTerm` for TI0NKF (09:26:09). That plate is a typo, so this result is expected.
   - No "VDG error" (non-200) or "VDG fetch failed" lines.
   - What this means: the key in VEHICLE_DATA_GLOBAL_API_KEY is being treated as a **sandbox/test key**. Sandbox keys only return data for VDG's test plates, so real plates fail. Either the key was swapped or reset to a sandbox key, or the live key's account was moved to sandbox (trial ended, or out of credit and downgraded). It is not a missing key and not a plain "invalid key" error.
2. **DVSA MOT**: no "Token error" lines, so the token request works. Every call to the MOT data address fails before any HTTP status comes back:
   - `TypeError: error sending request for url (https://history.mot.api.gov.uk/v1/trade/vehicles/registration/…): client error (Connect): received fatal alert: UnrecognisedName`
   - This is a TLS/DNS failure on DVSA's side ("unrecognised server name"). There's no 401, 403, 429 or 404 because the connection never completes. Either DVSA has changed or retired the `history.mot.api.gov.uk` address, or that address is currently misconfigured.
3. **Secrets** (names only): DVSA_MOT_CLIENT_ID, DVSA_MOT_CLIENT_SECRET, DVSA_MOT_TOKEN_URL, DVSA_MOT_API_KEY and VEHICLE_DATA_GLOBAL_API_KEY are **all set**.
4. **Recent successes**: none found in the readable log window. Every lookup shown failed on both sources, which is what produces the 404 "No vehicle found".

## Suggested next steps (need your approval)
- VDG: check the VDG account dashboard for credit, plan and live-vs-sandbox status. If it's on a sandbox key, put the live key into VEHICLE_DATA_GLOBAL_API_KEY. No code change is needed.
- DVSA: check DVSA's MOT History API notices for a new address. If it has moved, change the one URL in lookup-vehicle and redeploy that function only.
- Optional: have the "both sources failed" case return a 503 "lookup temporarily unavailable" instead of the misleading 404.
