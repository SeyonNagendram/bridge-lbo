"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "copied" | "failed";

const MESSAGE: Record<Status, string> = {
  idle: "",
  copied: "Link copied",
  failed: "Couldn’t copy. The address bar has the link.",
};

/**
 * Copies the link to the current scenario. `link` builds the URL at the moment of the click, so a
 * change made a split second earlier is included even before the debounced address bar update.
 * The confirmation is quiet: muted text beside the button for a few seconds, announced politely.
 */
export function CopyLink({ link }: { link: () => string }) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    let next: Status = "copied";
    try {
      await navigator.clipboard.writeText(link());
    } catch {
      next = "failed"; // no clipboard access (permissions, insecure context)
    }
    // Clear first, so copying twice in a row is announced twice.
    setStatus("idle");
    requestAnimationFrame(() => setStatus(next));
    timer.current = setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className="h-7 rounded-[6px] border border-border px-2.5 text-[13px] text-text transition-colors duration-150 hover:border-muted"
      >
        Copy link
      </button>
      <span role="status" className="text-[13px] text-muted">
        {MESSAGE[status]}
      </span>
    </div>
  );
}
