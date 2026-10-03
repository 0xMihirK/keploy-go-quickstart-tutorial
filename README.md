# Test a Go API by recording it

This is an interactive Keploy tutorial for Go developers who have never used Keploy. You record real traffic to a sample app, replay it with the database switched off, then break the app on purpose and watch a test catch it.

**Live site:** https://keploy-go-record-replay.vercel.app

It follows the **Running App Locally** path of Keploy's [Gin + MongoDB quickstart](https://keploy.io/docs/quickstart/samples-gin/). The Go app runs on your machine, and only MongoDB runs in Docker.

## What's on the page

The tutorial is one MDX page, [`app/page.mdx`](app/page.mdx), split into slides: an overview, how Keploy works, seven steps, and three reference pages. Move between them with the arrow keys, the buttons at the bottom, or the step list.

Each step pairs a short explanation and its commands with something to watch or do:

- **Practice terminals** play back my real run on a loop, with its real colors and pacing. Long waits are sped up. Click in, or start typing, and the terminal is yours: → fills in the next command and Enter runs it. Nothing runs in your browser.
- **A two-terminal record session.** Keploy records in one terminal while `curl` requests go out from the other, and each request appears as a captured test case.
- **A file explorer** for the `keploy/` folder Keploy generated, with notes on the lines that matter.
- **A noise switch** replays the same test with and without Keploy's noise rule, so you can see the failure the rule prevents.
- **Checkpoints** track your progress across visits.

## Every output is real

I ran the quickstart with Keploy 3.8.58 on October 2, 2026, on Ubuntu 22.04 in a container (Docker Desktop on Windows 11, WSL2 kernel). Every command and output on the page comes from that run.

- [`recordings/NOTES.md`](recordings/NOTES.md) lists every command I ran, the results, where I differed from the docs, and the problems I hit.
- [`recordings/terminal/`](recordings/terminal) holds the raw terminal sessions, captured with `script --log-timing`. The `.ansi` file is the output and the `.tm` file is its timing.
- [`recordings/gin-mongo/`](recordings/gin-mongo) holds the files Keploy generated: the test cases, the mocks, `config.yaml` and `keploy.yml`.
- [`scripts/import-captures.mjs`](scripts/import-captures.mjs) turns each session into `public/runs/*.json`, which the practice terminals replay.

To refresh the terminals after a new run, copy the captures into `recordings/terminal/` and run:

```bash
npm run captures
```

## Stack

- [Next.js 16](https://nextjs.org) App Router with [`@next/mdx`](https://nextjs.org/docs/app/guides/mdx). The page is prerendered as static HTML.
- [`rehype-pretty-code`](https://rehype-pretty.pages.dev) and [Shiki](https://shiki.style) for syntax highlighting at build time, with light and dark themes.
- [Tailwind CSS 4](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com) (Base UI): tabs, accordion, sheet and checkbox.
- [Magic UI's Terminal](https://magicui.design/docs/components/terminal), adapted in [`components/ui/terminal.tsx`](components/ui/terminal.tsx). I added design tokens, a title bar with a record or replay badge and copy button, reduced-motion support, a live region, and scrolling that follows the output.
- [Motion](https://motion.dev) for the record and replay diagram, View Transitions for moving between slides, and [`next-themes`](https://github.com/pacocoursey/next-themes) for the theme toggle. Dark is the default.

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
recordings/             raw captures, run notes and Keploy's generated files
scripts/                capture converter
```

## Why I built it this way

- **Slides instead of one long scroll.** Each step keeps its terminal beside the explanation; long lessons scroll in their own column.
- **Recorded runs, not a fake shell.** A shell in the browser would need a backend, and it still couldn't run Keploy's eBPF hooks. Replaying captured sessions keeps the output honest and the site static.
- **Linux first.** Microsoft Defender quarantined the native Windows build on my machine, so the tutorial sends Windows readers to WSL2 and explains why.
- **The terminal draws Keploy's banner itself.** Browsers render block characters such as `▓` with dithered font glyphs. The site draws them as cell-sized shapes, the way terminal apps do.

MIT licensed. Written by Mihir Katoch for the Keploy DevRel assignment. The sample app is from [keploy/samples-go](https://github.com/keploy/samples-go) (Apache 2.0).
