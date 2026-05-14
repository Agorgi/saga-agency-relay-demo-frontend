"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";

export function PostComposerModal() {
  const postComposerOpen = useAppStore((state) => state.postComposerOpen);
  const composeEventId = useAppStore((state) => state.composeEventId);
  const event = useAppStore((state) => state.events.find((item) => item.id === composeEventId));
  const postDraftCaption = useAppStore((state) => state.postDraftCaption);
  const updatePostDraft = useAppStore((state) => state.updatePostDraft);
  const closeComposer = useAppStore((state) => state.closeComposer);
  const submitPost = useAppStore((state) => state.submitPost);

  return (
    <AnimatePresence>
      {postComposerOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-80 flex items-center justify-center bg-black/62 px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            className="brand-surface-deep w-full max-w-[560px] rounded-[30px] p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/42">New post</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  {event ? `Posted from ${event.title}` : "Share to your Saga profile"}
                </h2>
              </div>
              <button
                onClick={closeComposer}
                className="rounded-full bg-white/8 p-2 text-white/72"
                aria-label="Close composer"
              >
                ×
              </button>
            </div>

            <textarea
              value={postDraftCaption}
              onChange={(event) => updatePostDraft(event.target.value)}
              placeholder="Share a recap, vendor drop, cosplay photo note, or launch update..."
              className="mt-6 min-h-[180px] w-full rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-4 text-white outline-none placeholder:text-white/28"
            />

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={closeComposer}
                className="rounded-pill border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/72"
              >
                Cancel
              </button>
              <button onClick={submitPost} className="brand-button-primary rounded-pill px-4 py-2.5 text-sm font-medium">
                Publish Post
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
