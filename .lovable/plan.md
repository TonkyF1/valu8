# Lookup test results (09:35 UTC, diagnose only, no changes made)

## Test calls
| Reg | HTTP | Code | Vehicle |
|---|---|---|---|
| BD67USJ | 200 | (found, from DVSA) | FORD Fiesta 2017 |
| T10NKF | 200 | (found, from DVSA) | RENAULT Clio 2010 |
| T1ONKF | 404 | not_found | none |
| TI0NKF | 404 | not_found | none |
| WV64MOK | 404 | not_found | none |

## Log counts since the redeploy (09:29 to 09:35)
- **DVSA, network error ("error sending request", the TLS UnrecognisedName fault):** 7 lines, all between 09:29 and 09:30. These failed after the one retry.
- **DVSA, http 404:** only 1 line (09:35:11) has shown up in the logs so far. The 404 responses above came from DVSA answering "not found", so the remaining lines are probably still arriving in the logs.
- **DVSA successes:** at least 2 (BD67USJ and T10NKF at 09:35). No line is logged on success.
- **VDG:** 8 lines for SandboxValidationFailure (status 6, error) and 3 for InvalidSearchTerm (status 13, not_found). VDG returned no vehicle in any call, so the key is still sandbox.

## Reading
DVSA looks like it recovered at about 09:30–09:35. Every call since then has connected. VDG still contributes nothing until a live key is added. WV64MOK returning 404 means DVSA has no MOT record for it. That is normal for a car under 3 years old, but WV64 is a 2014 plate, so treat it as an unconfirmed plate.
