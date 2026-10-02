import { readFileSync } from "node:fs";
import { join } from "node:path";

import { YamlExplorer, type ExplorerFile, type Note } from "./yaml-explorer";
import type { StackId } from "./stack";

const DIR: Record<StackId, string> = { gin: "gin-mongo", echo: "echo-sql" };

function read(stack: StackId, rel: string) {
  return readFileSync(join(process.cwd(), "recordings", DIR[stack], rel), "utf8");
}

/** Picks one YAML document out of a multi-document mocks file. */
function pickMock(all: string, contains: string) {
  const docs = all.split(/^---\n/m);
  const i = docs.findIndex((d) => d.includes(contains));
  return { doc: docs[i].trimEnd() + "\n", index: i + 1, total: docs.length };
}

const TEST_NOTES: Note[] = [
  {
    match: "^kind: Http",
    title: "A test case",
    body: "Each request you sent became one file like this. Mocks use other kinds, such as Mongo or PostgresV3.",
  },
  {
    match: "^  req:",
    title: "The request, exactly as sent",
    body: "Method, URL, headers and body from your curl call. During keploy test, Keploy sends this same request to your app.",
  },
  {
    match: "^  resp:",
    title: "The expected response",
    body: "What your app answered while recording. Replay passes only if the new response matches this.",
  },
  {
    match: "^    noise:",
    title: "Fields Keploy ignores",
    body: "Keploy added these on its own: values that change on every run, like a timestamp or the Date header. Without them the test would fail on every replay.",
  },
  {
    match: "^curl:",
    title: "A curl command to reproduce it",
    body: "Copy this to send the recorded request by hand while you debug.",
  },
];

const CONFIG_NOTES: Note[] = [
  {
    match: "^mockRegistry:",
    title: "Where the mocks live",
    body: "Keploy uploads mocks.yaml to its registry and stores the hash here. The keploy/.gitignore it generates excludes mocks.yaml, so you commit tests and config, and CI downloads the mocks by this hash.",
  },
];

const KEPLOY_YML_NOTES: Note[] = [
  {
    match: "^command:",
    title: "Your app command",
    body: "Saved from -c on your first record. Keploy uses it to start the app again for replay.",
  },
  {
    match: "^appName:",
    title: "App name",
    body: "Taken from the folder name. Test reports on app.keploy.io are grouped under it.",
  },
];

function filesFor(stack: StackId): ExplorerFile[] {
  const mocks = read(stack, "keploy/test-set-0/mocks.yaml");
  const mock =
    stack === "gin"
      ? pickMock(mocks, '"update":"url-shortener"')
      : pickMock(mocks, "INSERT INTO url_map");
  const mockNotes: Note[] =
    stack === "gin"
      ? [
          { match: "^kind: Mongo", title: "A MongoDB mock", body: "One database call your app made while recording: a query and the answer MongoDB gave." },
          { match: "^    requests:", title: "What the app sent", body: "The upsert of the short link, decoded from the MongoDB wire protocol." },
          { match: "^    responses:", title: "What MongoDB answered", body: "During replay, Keploy sends this back when the app makes the same call, so MongoDB can stay off." },
          { match: "^noise:", title: "Ignored request fields", body: "The created and updated timestamps differ on every run, so Keploy doesn't use them to match the call." },
        ]
      : [
          { match: "^kind: PostgresV3", title: "A PostgreSQL mock", body: "One database call your app made while recording: a query and the answer Postgres gave." },
          { match: "sqlNormalized:", title: "The SQL your app ran", body: "Keploy matches replayed queries on this normalized statement." },
          { match: "bindValues:", title: "Query parameters", body: "The values bound to $1…$4, stored as base64." },
          { match: "^            response:", title: "What Postgres answered", body: "During replay, Keploy returns this when the app runs the same INSERT, so Postgres can stay off." },
        ];

  return [
    {
      path: "keploy/test-set-0/tests/post-url-1.yaml",
      content: read(stack, "keploy/test-set-0/tests/post-url-1.yaml"),
      notes: TEST_NOTES,
    },
    {
      path: `keploy/test-set-0/tests/${stack === "gin" ? "get-7fvpssfg-1" : "get-4kepjktt-1"}.yaml`,
      content: read(
        stack,
        `keploy/test-set-0/tests/${stack === "gin" ? "get-7fvpssfg-1" : "get-4kepjktt-1"}.yaml`,
      ),
      notes: TEST_NOTES.filter((n) => n.match !== "^curl:"),
    },
    {
      path: "keploy/test-set-0/mocks.yaml",
      content: mock.doc,
      notes: mockNotes,
      caption: `mock ${mock.index} of ${mock.total}`,
    },
    {
      path: "keploy/test-set-0/config.yaml",
      content: read(stack, "keploy/test-set-0/config.yaml"),
      notes: CONFIG_NOTES,
    },
    {
      path: "keploy.yml",
      content: read(stack, "keploy.yml")
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("#"))
        .join("\n"),
      notes: KEPLOY_YML_NOTES,
      caption: "comments removed",
    },
  ];
}

export function KeployFiles({ stack }: { stack: StackId }) {
  return <YamlExplorer files={filesFor(stack)} />;
}
