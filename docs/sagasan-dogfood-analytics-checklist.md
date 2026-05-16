# Sagasan Dogfood Analytics Checklist

## What to inspect

- persona distribution
- nextStep emitted count
- nextStep clicked count
- handoff loaded count
- fallback used count
- validation failed count
- reset to landing count
- common issue labels
- most confusing routes
- most common persona pivots
- boundary prompt pass and fail rate

## Manual inspection method

If no shared analytics sink is available, inspect dogfood results using:

1. the feedback forms
2. the dogfood issue log
3. the admin web-chat session list and detail pages
4. session-local Sagasan telemetry in the browser during a live test

## What to summarize after the run

- which persona was most often confusing
- which CTA was least understood
- where handoff state felt weakest
- which fallback reason showed up most
- whether boundary prompts remained safe and understandable
