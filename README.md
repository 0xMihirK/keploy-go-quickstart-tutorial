# Test a Go API by recording it

An interactive Keploy tutorial for Go developers who have never used Keploy. You record a sample app's real traffic, replay it with the database switched off, then break the app on purpose and watch a test catch it.

**Live site:** _added after deploy_

![The record step: Keploy records in one terminal while you send requests from another](docs/screenshot.png)

It covers two of Keploy's Go quickstarts, switchable at the top of the page:

- [Gin + MongoDB](https://github.com/keploy/samples-go/tree/main/gin-mongo)
- [Echo + PostgreSQL](https://github.com/keploy/samples-go/tree/main/echo-sql)

## What's on the page

The tutorial is one MDX page, [`app/page.mdx`](app/page.mdx), split into slides: an overview, how Keploy works, seven steps, and three reference pages. Move with the arrow keys, the buttons at the bottom, or the step list.

Each step pairs a short explanation with something to do:

- **Practice terminals.** Type the command (→ fills it in, Enter runs it) or press "Run it for me". The output is replayed from my real run, with its real colours and pacing, sped up where Keploy waited a long time. Nothing runs in your browser.
- **A two-terminal record session.** Keploy records in one pane while you send `curl` requests from the other, and each request shows up as a captured test case.
- **A file explorer** for the `keploy/` folder Keploy generated, with notes on the lines that matter.
- **A noise switch** that replays the same test with and without Keploy's noise rule, so you see the failure it prevents.
- **Checkpoints** that track your progress across visits.

## Every output is real

I ran both quickstarts with Keploy 3.8.58 on 2 October 2026, in an Ubuntu 22.04 container on Docker Desktop (Windows 11, WSL2 kernel). Nothing on the page is invented:

- [`recordings/NOTES.md`](recordings/NOTES.md) lists every command I ran, the results, and the problems I hit.

- [`recordings/terminal/`](recordings/terminal) holds the raw terminal sessions, captured with `script --log-timing`: `.ansi` is the output, `.tm` is the timing.
- [`recordings/gin-mongo/`](recordings/gin-mongo) and [`recordings/echo-sql/`](recordings/echo-sql) hold the files Keploy generated: test cases, mocks, `config.yaml` and `keploy.yml`.
- [`scripts/import-captures.mjs`](scripts/import-captures.mjs) turns each session into `public/runs/*.json`, which the practice terminals replay.

To refresh the terminals after a new run, copy the captures into `recordings/terminal/` and run:

```bash
node scripts/import-captures.mjs
```

## Stack

- [Next.js 16](https://nextjs.org) App Router with [`@next/mdx`](https://nextjs.org/docs/app/guides/mdx). The page is prerendered as static HTML.
- [`rehype-pretty-code`](https://rehype-pretty.pages.dev) and [Shiki](https://shiki.style) for build-time syntax highlighting, with light and dark themes.
- [Tailwind CSS 4](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com) (Base UI): tabs, accordion, sheet and checkbox.
- [Magic UI's Terminal](https://magicui.design/docs/components/terminal), adapted in [`components/ui/terminal.tsx`](components/ui/terminal.tsx): design tokens, a title bar with a record or replay badge and copy button, reduced-motion support, a live region, and follow-the-output scrolling.
- [Motion](https://motion.dev) for the record and replay diagram and slide transitions, and [`next-themes`](https://github.com/pacocoursey/next-themes) for the dark mode toggle.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. `npm run build` produces the static site.

## Project layout

```text
app/
  page.mdx              the tutorial
  layout.tsx            header, slide controls, fonts, metadata
  opengraph-image.tsx   social preview card
components/
  docs/                 tutorial components (slides, terminals, explorer, callouts)
  ui/                   shadcn/ui and the adapted Magic UI terminal
lib/                    slide state, progress, ANSI rendering, run loader
recordings/             raw captures and Keploy's generated files
scripts/                capture converter
```

## Why I built it this way

- **Slides instead of one long scroll.** Each step fits on a screen with its terminal beside it, so you never scroll away from the thing you're doing.
- **Replay, not a fake shell.** A real shell in the browser would need a backend and still couldn't run Keploy's eBPF hooks. Replaying a captured session keeps the output honest and the site static.
- **Linux first.** The native Windows build was quarantined by Microsoft Defender on my machine, so the tutorial sends Windows readers to WSL2 and says why.
- **Two sample apps, one page.** Both stacks render into the HTML. A small script sets the choice before the first paint, so switching never flashes the wrong commands.

MIT licensed. Written by Mihir Katoch for the Keploy DevRel assignment. Sample apps are from [keploy/samples-go](https://github.com/keploy/samples-go) (Apache 2.0).
