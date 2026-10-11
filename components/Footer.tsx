// Footer (§5): static, rendered on the server only. Links are underlined, not only coloured, so they
// stand out from the muted text for everyone (WCAG 1.4.1).

import { AUTHOR_NAME, GITHUB_REPO_URL, LINKEDIN_URL } from "@/lib/site";

const link = "text-text underline underline-offset-4 decoration-border transition-colors duration-150 hover:decoration-muted";

export function Footer() {
  return (
    <footer className="mt-16 flex flex-col gap-2 border-t border-border pt-6 text-[13px] text-muted sm:flex-row sm:justify-between sm:gap-8">
      {/* Link texts name the destination, so they make sense on their own in a screen reader's links list. */}
      <p>
        Built by {AUTHOR_NAME}
        <span aria-hidden="true"> · </span>
        <span className="sr-only">. </span>
        <a href={LINKEDIN_URL} className={link}>
          LinkedIn
        </a>
        <span aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        <a href={GITHUB_REPO_URL} className={link}>
          GitHub
        </a>
      </p>
      <p>Illustrative model, not investment advice.</p>
    </footer>
  );
}
