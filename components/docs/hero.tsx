"use client";

import { ArrowRight, ArrowLeftRight, ArrowUpRight, Database, FlaskConical, GitBranch } from "lucide-react";

import { next } from "@/lib/slides";
import { cn } from "@/lib/utils";

/** The main call to action on the first slide: starts the tutorial. */
export function StartButton() {
  return (
    <button
      type="button"
      onClick={next}
      className="group inline-flex h-12 shrink-0 items-center gap-2.5 rounded-xl bg-orange px-6 text-[16px] font-semibold text-[#14161b] shadow-[0_12px_32px_-14px_var(--orange)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-14px_var(--orange)] focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none active:translate-y-0 active:scale-[0.98]"
    >
      Start the tutorial
      <ArrowRight
        className="size-4.5 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * The idea in two lines: one real request from the tutorial's run is
 * recorded into a test file, then replayed and passes. A dot travels each
 * row in turn (one loop, stopped under reduced motion).
 */
function Tape() {
  const rows = [
    {
      cmd: "keploy record",
      tone: "text-[#ff8a8e]",
      result: "tests/post-url-1.yaml",
      note: "and mocks.yaml",
    },
    {
      cmd: "keploy test",
      tone: "text-[#5fe0d8]",
      result: "200, as recorded",
      note: "MongoDB off",
    },
  ];
  return (
    <div
      className="overflow-hidden rounded-xl border border-tape-rule bg-tape font-mono text-[12.5px] text-tape-ink"
      aria-label="keploy record saves POST /url as tests/post-url-1.yaml; keploy test replays it and gets 200, as recorded, with MongoDB off."
      role="img"
    >
      {rows.map((r, i) => (
        <div
          key={r.cmd}
          className="grid grid-cols-[7.25rem_minmax(0,1fr)] items-center gap-3 border-b border-tape-rule px-4 py-3 last:border-b-0 max-sm:grid-cols-1 max-sm:gap-1.5"
        >
          <span className={cn("flex items-center gap-2", r.tone)}>
            <span className="size-1.5 rounded-full bg-current" />
            {r.cmd}
          </span>
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0">POST /url</span>
            <span className={cn("relative h-px min-w-6 flex-1 bg-tape-rule", r.tone)}>
              <span className="tape-dot absolute -top-[3px] size-[7px] rounded-full bg-current" style={{ animationDelay: `${i * 3}s` }} />
            </span>
            <span className="tape-result flex shrink-0 items-baseline gap-2" style={{ animationDelay: `${i * 3}s` }}>
              <span className={r.tone}>{r.result}</span>
              <span className="hidden text-tape-dim xl:inline">{r.note}</span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

const DOCS = "https://keploy.io/docs";

const USES = [
  {
    icon: ArrowLeftRight,
    title: "API and integration tests",
    body: "Record real requests, then replay them with databases and APIs mocked.",
    href: `${DOCS}/keploy-explained/how-keploy-works/`,
    current: true,
  },
  {
    icon: Database,
    title: "Mocks for the tests you have",
    body: "Wrap go test, pytest or jest; Keploy saves the database and HTTP calls they make.",
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
    body: "For Go code, a PR agent writes unit tests and keeps those that build, pass and raise coverage.",
    href: `${DOCS}/running-keploy/utg-pr-agent/`,
  },
];

/** What Keploy is used for: a short index, each row linked to Keploy's docs. */
function Uses() {
  return (
    <div>
      <h3 className="text-[14px] font-medium text-graphite">What you can test with it</h3>
      <ul className="mt-3 border-t border-rule">
        {USES.map(({ icon: Icon, title, body, href, current }) => (
          <li key={title} className="border-b border-rule">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "group relative flex gap-3.5 py-3.5 pr-7 pl-3 outline-none transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-orange/60",
                current && "bg-surface",
              )}
            >
              {current && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-orange" />}
              <Icon
                className={cn("mt-0.5 size-[18px] shrink-0", current ? "text-orange-text dark:text-orange" : "text-graphite")}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[15px] leading-snug font-semibold text-ink">{title}</span>
                  {current && (
                    <span className="text-[12.5px] font-medium text-orange-text dark:text-orange">This tutorial</span>
                  )}
                </span>
                <span className="mt-0.5 block text-[13.5px] leading-snug text-graphite">{body}</span>
              </span>
              <ArrowUpRight
                className="absolute top-4 right-1.5 size-4 text-graphite opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13.5px] leading-snug text-graphite">
        Using Python, Java, JavaScript or C#? Keploy has{" "}
        <a
          href={`${DOCS}/quickstart/quickstart-filter/`}
          target="_blank"
          rel="noreferrer"
          className="text-orange-text underline underline-offset-2 dark:text-orange"
        >
          quickstarts
        </a>{" "}
        for those too.
      </p>
    </div>
  );
}

/** The first slide: what Keploy is, what it tests, and the way in. */
export function IntroHero() {
  return (
    <div className="not-prose grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14">
      <div className="flex flex-col">
        <p className="text-[15px] font-medium text-graphite">What is Keploy?</p>
        <h2
          id="overview-title"
          className="mt-2 text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-[3.1rem] tall-short:text-[2.6rem]"
        >
          Keploy turns real API traffic into tests.
        </h2>
        <p className="mt-4 max-w-[36rem] text-[16.5px] leading-relaxed text-ink/85">
          It records the requests your app handles and the database and API calls it makes, then replays them as
          tests with those calls answered from the recording, so no real database is needed. Your code doesn&apos;t
          change, and the core engine is open source under Apache 2.0.
        </p>
        <div className="mt-6">
          <Tape />
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <StartButton />
          <p className="max-w-[24rem] text-[14px] leading-snug text-graphite">
            About 15 minutes with a Go app (Gin and MongoDB) on Linux or WSL2, with Go 1.22+, Docker and a free Keploy
            account.
          </p>
        </div>
      </div>
      <Uses />
    </div>
  );
}
