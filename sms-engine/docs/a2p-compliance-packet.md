# A2P / SMS Compliance Packet

This packet prepares the standalone Saga SMS Producer app for provider and
carrier compliance review. It is not a Twilio submission, legal approval, or
permission to enable live SMS.

## 1. Campaign Purpose

Saga SMS is used for user-initiated SMS intake and production coordination for
creative projects. The first intended use is design partner and private beta
testing with explicitly opted-in participants.

This campaign is not for marketing blasts, public mass outreach, cold outbound
prospecting, public number distribution, ticket sales, RSVP flows, payments, or
production Saga app integration.

## 2. Opt-In Flow

Users opt in through one of these reviewed paths:

- The user texts the Saga number after being invited or after seeing the opt-in
  language.
- The user explicitly submits their phone number for the Saga SMS pilot.

The opt-in surface should clearly explain that Saga SMS is for creative project
intake, creator profiles, production briefs, team recommendations, and pilot
feedback. Design partner/private beta participants should understand the app is
still in staging and cannot be relied on for confirmed bookings, payments,
urgent logistics, or production delivery.

## 3. Opt-In Copy

> By texting Saga or joining the Saga SMS pilot, you agree to receive messages
> from Saga about your creative project, creator profile, production brief, team
> recommendations, and pilot feedback. Message and data rates may apply. Reply
> STOP to opt out or HELP for help.

## 4. STOP Copy

> You're opted out of Saga SMS. Reply START to opt back in.

## 5. START Copy

> You're opted back in to Saga SMS. Reply STOP to opt out.

## 6. HELP Copy

> Saga helps collect creative project briefs and creator profile info over SMS.
> For help, contact [support email]. Reply STOP to opt out.

Replace `[support email]` with the reviewed support contact before submission or
live testing.

## 7. Sample Messages

- "Saga here. I can help turn this into a project brief. What city should this
  happen in?"
- "Got it - I'm turning this into a brief and mapping the roles that could help
  bring it to life."
- "Amazing - what kinds of gigs are you looking for? For example: photography,
  cosplay appearances, hosting, DJing, design, or vendor work."
- "Thanks for confirming. A human on the Saga team may review before anything
  is sent externally."
- "I want to make sure we handle that carefully. I'm going to flag this for the
  Saga team before moving forward."

## 8. Forbidden Claims

Saga SMS must not claim or imply:

- Guaranteed bookings.
- Guaranteed paid work.
- Guaranteed ticket sales.
- Confirmed team placement.
- Venue guarantees.
- Celebrity or influencer guarantees.

Saga should also avoid promising revenue, attendance, rates, event production,
group-chat inclusion, candidate availability, or external outreach unless a
human-reviewed workflow explicitly supports that future behavior.

## 9. Public Pages Needed

Before any compliance submission or public-facing launch review, prepare:

- Privacy policy.
- Terms.
- Support contact.
- Opt-in explanation page.
- Pilot landing page, if applicable.

These pages should say the standalone SMS producer app is separate from the main
Saga production app until a future engineer-reviewed integration.

## 10. Submission Checklist

Collect and review:

- Business legal name.
- EIN / business registration.
- Business address.
- Authorized representative.
- Website.
- Privacy URL.
- Terms URL.
- Opt-in screenshot or URL.
- Sample messages.
- Support email.

## Review Notes

- Do not submit this packet to Twilio until the business/legal/compliance owner
  approves the exact content.
- Do not enable outbound SMS until A2P/provider compliance is approved and the
  outbound self-test runbook is explicitly approved.
- Keep `SMS_SENDS_DISABLED=true` until an approved operator test window.
