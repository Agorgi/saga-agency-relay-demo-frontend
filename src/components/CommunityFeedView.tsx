"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAppStore } from "@/store/useAppStore";

export function CommunityFeedView() {
  const events = useAppStore((state) => state.events);
  const viewerProfile = useAppStore((state) => state.viewerProfile);
  const activeFeedTab = useAppStore((state) => state.activeFeedTab);
  const setFeedTab = useAppStore((state) => state.setFeedTab);
  const openComposer = useAppStore((state) => state.openComposer);
  const { openEvent } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const allPosts = useMemo(() => {
    return [...events.flatMap((event) => event.posts), ...viewerProfile.posts]
      .filter((post, index, array) => array.findIndex((candidate) => candidate.id === post.id) === index)
      .sort((a, b) => b.likes - a.likes);
  }, [events, viewerProfile.posts]);

  const followingPosts = useMemo(() => {
    return allPosts.filter((post) => post.authorId === viewerProfile.id || viewerProfile.attendingEventIds.includes(post.eventId || ""));
  }, [allPosts, viewerProfile.attendingEventIds, viewerProfile.id]);

  const posts = activeFeedTab === "explore" ? allPosts : followingPosts;

  return (
    <div className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 ${
      isDark ? "text-white" : "text-ink"
    }`}>
      <div className="mx-auto max-w-[1320px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[30px] p-5 sm:rounded-[34px] sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Community feed</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Explore / Following</h1>
              <p className={`mt-4 max-w-[720px] text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>
                Posts, cosplay shots, event recaps, vendor drops, and fan art keep the event ecosystem alive between launches.
              </p>
            </div>
            <button
              onClick={() => openComposer(null)}
              className="brand-button-primary rounded-pill px-4 py-3 text-sm font-medium"
            >
              New Post
            </button>
          </div>

          <div className="mt-6 flex gap-2">
            <TabButton active={activeFeedTab === "explore"} label="Explore" onClick={() => setFeedTab("explore")} dark={isDark} />
            <TabButton active={activeFeedTab === "following"} label="Following" onClick={() => setFeedTab("following")} dark={isDark} />
          </div>
        </motion.section>

        <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
          {posts.map((post, index) => (
            <motion.button
              key={post.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => post.eventId && openEvent(post.eventId)}
              className={`mb-4 w-full break-inside-avoid overflow-hidden rounded-[28px] text-left ${
                isDark ? "brand-surface-deep" : "brand-surface-strong"
              }`}
            >
              <div className="relative aspect-[0.9]">
                <Image
                  src={post.imageUrl}
                  alt={post.caption}
                  fill
                  sizes="(max-width: 1280px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  {post.authorAvatar ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-full">
                      <Image src={post.authorAvatar} alt={post.authorName} fill sizes="40px" className="object-cover" />
                    </div>
                  ) : (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${isDark ? "bg-white/10" : "bg-canvas text-ink"}`}>
                      {post.authorName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className={`text-sm font-medium ${isDark ? "text-white/84" : "text-ink"}`}>{post.authorName}</p>
                    <p className={`text-xs ${isDark ? "text-white/44" : "text-ink-light"}`}>{post.createdAt}</p>
                  </div>
                </div>

                <p className={`mt-4 text-sm leading-6 ${isDark ? "text-white/76" : "text-ink-light"}`}>{post.caption}</p>
                {post.eventTitle && (
                  <p className={`mt-3 text-xs uppercase tracking-[0.22em] ${isDark ? "text-white/36" : "text-ink-light"}`}>
                    Posted from {post.eventTitle}
                  </p>
                )}

                <div className={`mt-4 flex items-center justify-between text-xs ${isDark ? "text-white/42" : "text-ink-light"}`}>
                  <span>{post.likes} likes</span>
                  <span>{post.eventId ? "Open event" : "Profile post"}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
  dark,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  dark: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill px-4 py-2 text-sm font-medium ${
        active
          ? dark
            ? "bg-white text-[#101624]"
            : "brand-chip-signal"
          : dark
            ? "bg-white/8 text-white/66"
            : "brand-chip text-ink-light"
      }`}
    >
      {label}
    </button>
  );
}
