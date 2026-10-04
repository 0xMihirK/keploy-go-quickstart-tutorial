"use client";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { useProgress } from "@/lib/progress";
import { STEP_IDS, goTo, indexOf } from "@/lib/slides";
import { cn } from "@/lib/utils";

const DOCS = "https://keploy.io/docs";
const REPO = "https://github.com/0xMihirK/keploy-go-quickstart-tutorial";

/**
 * What the steps did, as the three commands that did it, in the same tape
 * colours as the first slide: record, replay, and the replay that failed.
 */
function RunLog() {
  const progress = useProgress();
  const done = STEP_IDS.filter((id) => progress[id]).length;
  const all = done === STEP_IDS.length;
  const rows = [
    { cmd: "keploy record", tone: "text-[#ff8a8e]", what: "Two requests saved as tests, MongoDB calls saved as mocks" },
    { cmd: "keploy test", tone: "text-[#5fe0d8]", what: "Both tests replayed and passed with MongoDB stopped" },
    { cmd: "keploy test", tone: "text-[#ff6b70]", what: "A 303 changed to 301, and the replay failed on it", failed: true },
  ];
  return (
    <section aria-labelledby="run-log-title" className="overflow-hidden rounded-xl border border-tape-rule bg-tape text-tape-ink">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-tape-rule px-4 py-2.5">
        <h3 id="run-log-title" className="text-[13.5px] font-semibold">
          What the steps covered
        </h3>
        <p className={cn("flex items-center gap-1.5 text-[12.5px]", all ? "text-[#5fe0d8]" : "text-tape-dim")}>
          {all && <Check className="size-3.5" aria-hidden="true" />}
          {all ? `All ${STEP_IDS.length} steps checked off` : `${done} of ${STEP_IDS.length} steps checked off`}
        </p>
      </div>
      <ol className="font-mono text-[12.5px]">
        {rows.map((r) => (
          <li
            key={r.what}
            className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-3 border-b border-tape-rule px-4 py-2.5 last:border-b-0 max-sm:grid-cols-1 max-sm:gap-1"
          >
            <span className={cn("flex items-center gap-2", r.tone)}>
              {r.failed ? (
                <span aria-hidden="true" className="w-1.5 text-center text-[11px] leading-none">✕</span>
              ) : (
                <span aria-hidden="true" className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-current" />
              )}
              {r.cmd}
            </span>
            <span className="font-sans text-[14px] leading-snug text-tape-ink/90">{r.what}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface Path {
  /** The command that starts it, or where it happens when there isn't one. */
  cmd: string;
  command?: boolean;
  title: string;
  body: React.ReactNode;
  links: { label: string; href?: string; slide?: string }[];
}

const GROUPS: { title: string; paths: Path[] }[] = [
  {
    title: "Make it routine",
    paths: [
      {
        cmd: "keploy test",
        command: true,
        title: "Run the tests in CI",
        body: (
          <>
            Commit the <code>keploy/</code> folder, save an API key from app.keploy.io as the{" "}
            <code>KEPLOY_API_KEY</code> secret, and run the same <code>keploy test</code> in the job. CI fetches the
            mocks by the hash in <code>config.yaml</code>, so record and replay once locally first.
          </>
        ),
        links: [
          { label: "GitHub Actions", href: `${DOCS}/ci-cd/github/` },
          { label: "GitLab", href: `${DOCS}/ci-cd/gitlab/` },
        ],
      },
      {
        cmd: "keploy mcp-install --editor <name>",
        command: true,
        title: "Ask your AI agent for tests",
        body: <>Connect Keploy to Claude Code, Cursor, Antigravity or OpenCode and ask it to generate API tests.</>,
        links: [{ label: "Connect your agent", slide: "ai-agents" }],
      },
      {
        cmd: "On pull requests",
        title: "Generate unit tests",
        body: (
          <>
            Keploy&apos;s PR agent writes unit tests on your pull requests and keeps the ones that build, pass and
            raise coverage. It supports Go today.
          </>
        ),
        links: [{ label: "PR agent", href: `${DOCS}/running-keploy/utg-pr-agent/` }],
      },
    ],
  },
  {
    title: "Test more of this app",
    paths: [
      {
        cmd: "keploy record",
        command: true,
        title: "Record more cases",
        body: (
          <>
            Start MongoDB with <code>docker compose start mongo</code>, record again and send other requests, such
            as a short code that doesn&apos;t exist and returns 404. Each run adds a test set.
          </>
        ),
        links: [],
      },
      {
        cmd: 'keploy mock record -c "go test ./..."',
        command: true,
        title: "Mock the tests you already have",
        body: (
          <>
            Keploy saves the database and HTTP calls your suite makes, and <code>keploy mock replay</code> answers
            them from the mocks next time. It works the same with pytest or jest.
          </>
        ),
        links: [{ label: "Mock your tests", href: `${DOCS}/running-keploy/mock-your-tests/` }],
      },
    ],
  },
  {
    title: "Beyond the sample",
    paths: [
      {
        cmd: 'keploy record -c "<your start command>"',
        command: true,
        title: "Try your own service",
        body: (
          <>
            Tests and mocks store request and response bodies as they are, so record with test data. <code>keploy sanitize</code> removes sensitive values from test cases.
          </>
        ),
        links: [],
      },
      {
        cmd: "Python, Java, JavaScript, C#",
        title: "Explore other stacks",
        body: <>Keploy&apos;s quickstarts cover other languages, and the Go samples include gRPC, MySQL and Redis apps.</>,
        links: [
          { label: "Quickstarts", href: `${DOCS}/quickstart/quickstart-filter/` },
          { label: "Go samples", href: "https://github.com/keploy/samples-go" },
        ],
      },
    ],
  },
];

const linkCls =
  "inline-flex items-center gap-1 rounded-sm text-[14px] font-medium text-orange-text underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-orange/60 dark:text-orange";

function PathItem({ p }: { p: Path }) {
  return (
    <li className="py-5 first:pt-4">
      <p
        className={cn(
          "leading-snug [overflow-wrap:anywhere]",
          p.command ? "font-mono text-[13px] text-ink" : "text-[13px] font-medium text-graphite",
        )}
      >
        {p.command && (
          <span aria-hidden="true" className="mr-2 text-orange-text select-none dark:text-orange">
            $
          </span>
        )}
        {p.cmd}
      </p>
      <h4 className="mt-2 text-[16px] leading-snug font-semibold text-ink">{p.title}</h4>
      <p className="next-body mt-1 text-[14.5px] leading-relaxed text-ink/80">{p.body}</p>
      {p.links.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {p.links.map((l) =>
            l.slide ? (
              <a
                key={l.label}
                href={`#${l.slide}`}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(indexOf(l.slide!));
                }}
                className={linkCls}
              >
                {l.label}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>
            ) : (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={linkCls}>
                {l.label}
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            ),
          )}
        </p>
      )}
    </li>
  );
}

/** The last slide: what you did, then where each next step starts. */
export function NextSteps() {
  return (
    <div className="not-prose">
      <RunLog />
      <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`next-${g.title.toLowerCase().replaceAll(" ", "-")}`} className="border-t border-rule">
            <h3 id={`next-${g.title.toLowerCase().replaceAll(" ", "-")}`} className="pt-3 text-[14px] font-medium text-graphite">
              {g.title}
            </h3>
            <ul className="divide-y divide-rule/70">
              {g.paths.map((p) => (
                <PathItem key={p.title} p={p} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-10 border-t border-rule pt-4 text-[13.5px] leading-relaxed text-graphite">
        Every Keploy terminal in this tutorial replays a recorded run of its exact commands; the AI agent sessions are
        illustrations. The captures and generated files are in the{" "}
        <a
          href={`${REPO}/tree/main/recordings`}
          target="_blank"
          rel="noreferrer"
          className="text-orange-text underline underline-offset-2 dark:text-orange"
        >
          recordings folder
        </a>{" "}
        of the site&apos;s repository. Written by Mihir Katoch.
      </p>
    </div>
  );
}
