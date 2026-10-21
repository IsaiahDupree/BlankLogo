# BlankLogo conversion events

BlankLogo sends these product conversion events through the existing PostHog client. Both event helpers return without sending when PostHog has not initialized.

| Event | Trigger | Properties | Meaning |
| --- | --- | --- | --- |
| `signup_submitted` | Supabase email signup returns successfully on `/signup` or `/promo` | `method=email`, `source=signup\|promo`, `email_confirmation_required=true` | Account creation request accepted; email confirmation may still be pending. It does not mean the user activated or paid. |
| `download_clicked` | User clicks a result or project asset download link | `asset_type`, `placement`, optional `platform` | Download intent. A click does not prove the browser finished transferring the file. |

The events intentionally omit email addresses, filenames, source URLs, raw video URLs, signed storage URLs, and job/project identifiers. PostHog's automatic page context can be used to group events by landing and app page. Do not interpret `download_clicked` as a completed download or `signup_submitted` as a confirmed account.
