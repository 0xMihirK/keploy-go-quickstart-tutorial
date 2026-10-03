"use client";

import { ArrowRight, ArrowLeftRight, Database, FlaskConical, GitBranch } from "lucide-react";

import { next } from "@/lib/slides";
import { cn } from "@/lib/utils";

/** The main call to action on the first slide: starts the tutorial. */
export function StartButton() {
  return (
    <button
      type="button"
      onClick={next}
      className="not-prose group relative inline-flex h-12 shrink-0 items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#c2410c] to-[#be123c] px-6 text-[16px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--orange)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-10px_var(--orange)] focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none active:translate-y-0 active:scale-[0.98]"
    >
      Start the tutorial
      <ArrowRight
        className="size-4.5 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

const DOCS = "https://keploy.io/docs";

const TYPES = [
  {
    icon: ArrowLeftRight,
    title: "API and integration tests",
    body: "Record real requests, then replay them as tests with databases and APIs mocked.",
    href: `${DOCS}/keploy-explained/how-keploy-works/`,
    tag: "This tutorial",
  },
  {
    icon: Database,
    title: "Mocks for the tests you have",
    body: "Wrap go test, pytest or jest, and Keploy saves the database and HTTP calls they make.",
    href: `${DOCS}/running-keploy/mock-your-tests/`,
  },
  {
    icon: GitBranch,
    title: "Regression tests in CI",
    body: "Replay the recorded tests on every pull request in GitHub Actions or GitLab.",
    href: `${DOCS}/ci-cd/github/`,
  },
  {
    icon: FlaskConical,
    title: "Unit test generation",
    body: "For Go code, a PR agent writes unit tests and keeps only those that build, pass and raise coverage.",
    href: `${DOCS}/running-keploy/utg-pr-agent/`,
  },
];

/** What Keploy can be used for, each linked to its page in Keploy's docs. */
export function TestingTypes() {
  return (
    <ul className="not-prose grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TYPES.map(({ icon: Icon, title, body, href, tag }) => (
        <li key={title}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "group flex h-full flex-col rounded-xl border bg-surface p-3.5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5",
              tag ? "border-orange/50" : "border-rule hover:border-graphite/50",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  tag ? "bg-orange/15 text-orange-text dark:text-orange" : "bg-muted text-graphite",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {tag && (
                <span className="rounded-full bg-orange/15 px-2 py-0.5 text-[11.5px] font-semibold text-orange-text dark:text-orange">
                  {tag}
                </span>
              )}
            </span>
            <span className="mt-2.5 text-[15px] leading-snug font-semibold text-ink">{title}</span>
            <span className="mt-1 text-[13.5px] leading-snug text-graphite">{body}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
