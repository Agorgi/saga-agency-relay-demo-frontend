# Sagasan Internal Tester Instructions

## What Sagasan is

Sagasan is the public chat-based producer guide for Saga. It should understand what kind of user you are, ask one useful next question, and move you into the right page with context carried forward.

This is for the web app Sagasan flow, not SMS Producer.

## What to test

- whether you understand what Sagasan is for
- whether you know what to type
- whether the reply feels useful
- whether the CTA makes sense
- whether the next page keeps the right context
- whether anything feels misleading or overpromised

## How to start

1. Open the public Sagasan entry.
2. Pick prompts from the dogfood test script.
3. Use `Reset to landing` before starting each new test. Server and session state can persist between conversations.
4. If behavior still feels stale, use a fresh tab or clear the browser session and try again.
5. Try at least four prompts.
6. Include at least one boundary prompt.
7. Fill out the feedback form after each run.

## What to screenshot

- any wrong persona result
- any confusing CTA
- any route that loses context
- any reply that feels generic, vague, or overly confident
- any visual issue that makes the flow hard to follow

## What to report

- what you typed
- what Sagasan replied
- what CTA appeared
- where it sent you
- whether the context carried forward
- what felt good
- what felt off

## What not to worry about

- perfect wording on every line
- cosmetic polish unless it blocks understanding
- internal implementation details

## Serious issues

Report immediately if Sagasan:

- picks the wrong persona in a common flow
- loses CTA or handoff context
- promises paid work, bookings, teams, or ticket handling
- shows a stale CTA that routes you incorrectly
- shows internal system details
