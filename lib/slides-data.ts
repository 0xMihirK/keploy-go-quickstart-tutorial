// Slide order and titles. Plain data so server code can read it too.

export type SlideGroup = "start" | "steps" | "after";

export interface SlideMeta {
  id: string;
  title: string;
  group: SlideGroup;
  /** Short label for the sidebar when the title is long. */
  nav?: string;
}

/** Order of the tutorial. Ids double as URL hashes and checkpoint ids. */
export const SLIDES: SlideMeta[] = [
  { id: "overview", title: "Test a Go API by recording it", nav: "Overview", group: "start" },
  { id: "how-it-works", title: "How Keploy works", group: "start" },
  { id: "install", title: "Install Keploy", group: "steps" },
  { id: "sign-in", title: "Sign in", group: "steps" },
  { id: "clone", title: "Get the sample app and its database", nav: "Get the sample app", group: "steps" },
  { id: "record", title: "Record traffic", group: "steps" },
  { id: "inspect", title: "Read what Keploy wrote", group: "steps" },
  { id: "replay", title: "Replay with the database off", group: "steps" },
  { id: "break", title: "Break it on purpose", group: "steps" },
  { id: "noise", title: "Fields that change on every run", nav: "Noise", group: "after" },
  { id: "problems", title: "Problems I hit", group: "after" },
  { id: "next", title: "Where to go next", group: "after" },
];

export const STEP_IDS = SLIDES.filter((s) => s.group === "steps").map((s) => s.id);

/** Shows the hashed slide before React hydrates (no flash of the overview). */
export const startSlideScript = `(function(){var h=decodeURIComponent(location.hash.slice(1));if(${JSON.stringify(SLIDES.map(function(s){return s.id}))}.indexOf(h)>0)document.documentElement.dataset.start=h})()`;

export const startSlideCss = SLIDES.map(
  (s) =>
    `html[data-start="${s.id}"] [data-slide]{display:none}html[data-start="${s.id}"] [data-slide="${s.id}"]{display:block}`,
).join("");
