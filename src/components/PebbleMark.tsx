"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { requestWebChatReset } from "@/components/web-chat/useWebChat";

export function PebbleMark() {
  const router = useRouter();

  return (
    <motion.button
      onClick={() => {
        requestWebChatReset();
        router.push("/?new=1");
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="brand-chip flex items-center rounded-pill px-2 py-2 sm:px-2.5 sm:py-2.5"
      aria-label="Reset to landing"
    >
      <div className="brand-surface-inset relative h-9 w-9 overflow-hidden rounded-full sm:h-11 sm:w-11">
        <Image
          src="/branding/saga-mark-purple.png"
          alt="Saga mark"
          fill
          sizes="(max-width: 640px) 36px, 44px"
          className="object-contain"
        />
      </div>
    </motion.button>
  );
}
