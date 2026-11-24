# CloudTips Trigger for n8n

**Experimental, unofficial community node. Not affiliated with CloudTips or n8n.**

For self-hosted n8n on Node.js 22+. No standalone listener or extra running service required. CommonJS JavaScript with one runtime dependency: ws.

## Installation

Once published to npm, open Settings → Community Nodes → Install, enter `n8n-nodes-cloudtips@0.1.0`, and review the unverified-code warning. Allow outbound HTTPS (443) and WSS (3030) to streamers-api.cloudtips.ru.

Add CloudTips Trigger to a new workflow, create CloudTips Widget credentials, and paste your notification widget URL or ID. Treat the URL as a secret.

## Behavior

The trigger obtains a fresh connection token, registers the notification subscription and connects via SignalR over WebSocket. It sends keep-alives, reconnects with exponential backoff, and closes its connection when deactivated.

Each SendNotification event emits notificationId, title, comment, eventType, paymentVerified (always false), and raw.

**Streaming notifications are not verified payment receipts.** Test alerts and repeated alerts may be indistinguishable from actual donations. Notification ID uniqueness, replay and offline delivery are unverified. Do not automate financial decisions or publish payment claims based solely on this trigger.

## Testing and usage

Run `npm test` for mocked protocol tests. Live CloudTips and n8n integration are not yet validated. First run a private diagnostic workflow with Telegram disconnected, send a test notification and compare it to an actual payment event. Never share credentials or real notification payloads in public issues.

For an AI-generated thank-you workflow, use the trigger, event classification, deduplication if IDs prove stable, Basic LLM Chain, Compose Message and Telegram. Keep factual payment data outside the model, treat comments as untrusted input, use plain-text output and a deterministic fallback. Do not send donor information to an external model without considering privacy.

## License

MIT. Unofficial integration using the streaming widget protocol, which may change without notice.
