import { joinPublicBetaWaitlistAction } from "@/app/beta/actions";
import {
  getCappedPublicBetaConfig,
  PUBLIC_BETA_CONSENT_TEXT,
} from "@/lib/publicBeta/publicBetaConfig";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-700";
const labelClass = "block text-sm font-medium text-zinc-800";
const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800";

function StatusMessage({ status }: { status?: string | null }) {
  if (status === "joined") {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
        Thanks. Your interest was saved for review. Joining does not guarantee access,
        bookings, payments, or production support.
      </div>
    );
  }
  if (status === "duplicate") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        We already have a waitlist record for that contact info. No message was sent.
      </div>
    );
  }
  if (status === "closed") {
    return (
      <div className="rounded-md border border-zinc-300 bg-zinc-100 p-3 text-sm text-zinc-700">
        The public beta waitlist is not accepting signups right now.
      </div>
    );
  }
  return null;
}

export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const config = getCappedPublicBetaConfig();
  const formEnabled =
    config.publicBetaLandingEnabled && config.publicBetaWaitlistEnabled;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-12">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Saga SMS beta
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">
            Creative project coordination over text, currently in private beta.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            Saga helps collect creative project ideas, creator profile details,
            pilot feedback, and production coordination notes. Public access is
            capped and reviewed by operators before admission.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <StatusMessage status={params.status} />

          {!config.publicBetaLandingEnabled ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">Public beta is not open yet.</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Saga SMS is currently in private beta. We are not publishing the
                SMS number or accepting public signups from this page yet.
              </p>
            </section>
          ) : null}

          {config.publicBetaLandingEnabled && !config.publicBetaWaitlistEnabled ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">Waitlist is paused.</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Saga SMS is in private beta. Joining the waitlist does not
                guarantee access, bookings, payments, or production support.
              </p>
            </section>
          ) : null}

          {formEnabled ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">Join the waitlist</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                This form records interest only. It does not admit you to the
                beta, send SMS, create a booking, or connect to the main Saga app.
              </p>
              <form action={joinPublicBetaWaitlistAction} className="mt-5 space-y-4">
                <label className={labelClass}>
                  Name
                  <input name="name" className={inputClass} autoComplete="name" />
                </label>
                <label className={labelClass}>
                  Email
                  <input name="email" className={inputClass} type="email" autoComplete="email" />
                </label>
                <label className={labelClass}>
                  Phone
                  <input name="phone" className={inputClass} type="tel" autoComplete="tel" />
                </label>
                <label className={labelClass}>
                  City
                  <input name="city" className={inputClass} autoComplete="address-level2" />
                </label>
                <label className={labelClass}>
                  Use case
                  <select name="desiredUseCase" className={inputClass} defaultValue="UNKNOWN">
                    <option value="ORGANIZER">I organize projects or events</option>
                    <option value="CREATOR">I want creator/gig opportunities</option>
                    <option value="INTEREST_CHECK">I have a fandom/community idea</option>
                    <option value="OTHER">Something else</option>
                    <option value="UNKNOWN">Not sure yet</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Fandoms or scenes
                  <input
                    name="fandoms"
                    className={inputClass}
                    placeholder="Anime, cosplay, gaming, local creators"
                  />
                </label>
                {config.publicBetaRequireConsent ? (
                  <label className="flex gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                    <input name="consent" type="checkbox" required className="mt-1 h-4 w-4" />
                    <span>{PUBLIC_BETA_CONSENT_TEXT}</span>
                  </label>
                ) : null}
                <button className={buttonClass}>Submit waitlist interest</button>
              </form>
            </section>
          ) : null}

          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Current access limits</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
              <li>Public beta enabled: {String(config.publicBetaEnabled)}</li>
              <li>Public number visible: {String(config.publicBetaPublicNumberVisible)}</li>
              <li>Public launch enabled: {String(config.publicLaunchEnabled)}</li>
              <li>SMS sends disabled: {String(config.smsSendsDisabled)}</li>
            </ul>
            {!config.publicBetaPublicNumberVisible ? (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                The Saga SMS number is not shown on this page.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                SMS number display is enabled, but no public number is configured in
                this app route.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
