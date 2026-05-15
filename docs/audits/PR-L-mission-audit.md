# PR-L Mission Audit

| Page | Element | Kept / Killed | Reason |
| --- | --- | --- | --- |
| `/` | Inline Sagasan launcher + persona chips | Kept | This is the fastest path to gather intent and route the user. |
| `/` | Standalone marketing CTA blocks | Killed | Extra buttons distracted from the intake-first mission. |
| `/post-project` | Fixed-text demo simulation | Killed | The canned texting demo contradicted the live agent mission and is now a `308` redirect to `/?intent=host`. |
| `/projects/new` | Read-and-confirm brief preview | Kept | The agent already gathered the inputs, so this page should only confirm and hand the host toward matching. |
| `/projects/new` | Second form / duplicate intake | Killed | Re-asking for information would break the chat-first flow. |
| `/projects` | Top-bar `Coordinate` button | Killed | It duplicated per-card next actions and did not advance the user more clearly than the stage CTA. |
| `/projects` | One primary action per card | Kept | Each card now points the host to the single next job that matters. |
| `/explore` | `Picks for you` row | Kept | Curated picks directly support the host matching path. |
| `/explore` | Disclosure-style filters | Kept | Filters are still useful, but they stay hidden until the user needs them. |
| `/explore` | Extra top-level CTAs | Killed | They pulled focus away from matching talent. |
| `/me` | Single feed with one action per card | Kept | Creatives get one routed destination with one next action per item. |
| `/spaces` | Empty state + one CTA | Kept | Venue users either review routed requests or start listing through Sagasan. |
| `/feed` | Single-column event feed | Kept | Fan users land directly in discovery instead of a multi-panel dashboard. |
| `/relay` | Shared two-sided composers | Killed | A user should never write as both sides of the conversation. |
| `/relay` | One persona-aware composer | Kept | Hosts and creatives now only write from their own side, while the opposite side becomes a read-only peek. |
| `/relay` | Saga summary + extracted terms cards | Kept | These still show the value of the relay without adding extra decision points. |
| Global nav | `Home · For me · Discover` | Kept | Three destinations are enough to route each persona without clutter. |
| Global nav | Legacy extra nav items | Killed | They no longer help the user move from intake to destination. |
