"use client";

import { AppChrome } from "@/components/AppChrome";
import { PostComposerModal } from "@/components/PostComposerModal";

export function AppFrame({
  children,
  chrome = true,
  composer = true,
}: {
  children: React.ReactNode;
  chrome?: boolean;
  composer?: boolean;
}) {
  return (
    <main className="brand-page relative h-screen w-screen overflow-hidden">
      <div className="app-atmosphere pointer-events-none fixed inset-0" />
      <div className="pointer-events-none fixed inset-x-0 top-[-10vh] z-0 h-[42vh] bg-[radial-gradient(circle_at_top,rgba(255,79,158,0.14),transparent_58%)] blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-12vh] left-[-8vw] z-0 h-[34vh] w-[34vw] min-w-[280px] rounded-full bg-[radial-gradient(circle,rgba(71,37,255,0.14),transparent_68%)] blur-3xl" />
      <div className="pointer-events-none fixed right-[-10vw] top-[18vh] z-0 h-[34vh] w-[34vw] min-w-[280px] rounded-full bg-[radial-gradient(circle,rgba(126,164,255,0.18),transparent_66%)] blur-3xl" />
      {chrome ? <AppChrome /> : null}
      {children}
      {composer ? <PostComposerModal /> : null}
    </main>
  );
}
