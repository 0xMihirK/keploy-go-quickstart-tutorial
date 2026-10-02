# Run notes

These are my notes from running Keploy's Gin + MongoDB quickstart on October 2, 2026. I followed the docs' **Running App Locally** path ([keploy.io/docs/quickstart/samples-gin](https://keploy.io/docs/quickstart/samples-gin/)), where the Go app runs on the machine and only MongoDB runs in Docker. Every command and output in the tutorial comes from these runs.

## Setup

- The host was Windows 11 Home with Docker Desktop 29.7.2. Docker Desktop's Linux VM runs the WSL2 kernel 6.18.40.1-microsoft-standard-WSL2.
- The clean run happened in a privileged Ubuntu 22.04 container on that kernel, with Go 1.24.2. It used the host network and ran as root. I repeated the record step afterwards as a normal user (see below).
- I installed Keploy with `curl --silent -O -L https://keploy.io/install.sh && source install.sh`, which installed **Keploy 3.8.58**. The output is in `terminal/01-install.ansi`.
- MongoDB came from the sample's compose file (`docker compose up -d mongo`). The `mongo` image resolved to **MongoDB 9.0.2** (`mongod --version`).
- Samples: `keploy/samples-go` at commit `2b0a034` (September 4, 2026).
- The sample's `docker-compose.yaml` declares `keploy-network` as `external: true`, so Compose doesn't create it. It also has a `version: "3.9"` line, which makes Compose warn that `version` is obsolete.

## What I ran

Each run has a raw capture in `terminal/`. The `.ansi` file is the output and the `.tm` file is its timing, both recorded with `script --log-timing`. 03-clone, the compose output and 32-gin-globalnoise were captured after the main run, with identical commands.

| Capture | Command |
|---|---|
| 01-install | `curl --silent -O -L https://keploy.io/install.sh && source install.sh` |
| 02-login | `keploy login` (approved in the browser) |
| 03-clone | `git clone https://github.com/keploy/samples-go.git` |
| 10-gin-record | `keploy record -c "go run main.go handler.go"`, then Ctrl+C |
| 11-gin-post / 12-gin-get | the two `curl` requests from a second terminal |
| 20-gin-test | `keploy test -c "go run main.go handler.go" --delay 10` with MongoDB stopped |
| 30-gin-break | the same, after changing `StatusSeeOther` to `StatusMovedPermanently` |
| 31-gin-nonoise | the same, after deleting `body.ts: []` from the test file |
| 32-gin-globalnoise | the same, with `body.ts` only in `keploy.yml` under `test.globalNoise.global` |

Before recording I ran `rm -rf keploy`, `sed -i 's/mongoDb:27017/localhost:27017/' main.go` and `docker compose up -d mongo`. The compose output is in `terminal/docker-compose.txt`. The tutorial also runs `docker network create keploy-network 2>/dev/null || true` before `docker compose up`, because of the external network above.

My break-it capture used a longer `sed` that replaced the whole `c.Redirect(...)` call. The tutorial shows a shorter `sed`. `StatusSeeOther` appears only once in `handler.go`, so both make the same edit.

## Results

- **Recorded:** `post-url-1` and `get-7fvpssfg-1`, plus `mocks.yaml` with 5 MongoDB mocks.
- **Auto-replay after Ctrl+C:** 2/2 passed.
- **`keploy test` with MongoDB stopped:** 2/2 passed in 10.17 s.
- **Break it:** 1 failed, with expected 303 and actual 301.
- **Noise rule removed:** 1 failed on `ts`.
- **Noise rule in `keploy.yml` instead:** 2/2 passed.

The files Keploy generated are in `gin-mongo/`. I left out Keploy's own `keploy/.gitignore` (`/reports/`, `/*/mocks.yaml`) so the mocks stay visible.

## Differences from the docs

- The docs say to edit line 21 of `main.go`. In the current sample, the MongoDB address is on line 35.
- The docs don't stop MongoDB before `keploy test`. I did, to check that the mocks stand in for it.
- On macOS the docs record a built binary instead: `go build`, then `keploy record -c "./test-app-url-shortener"`. I didn't test macOS.

## Running as a normal user

See `terminal/non-root-user.txt`.

- `keploy record` restarts itself with sudo and asks for the password: `[sudo] password for dev:`.
- With sudo allowed, the same user recorded a test, and the files Keploy wrote belong to that user, not to root.
- For a new user, the first `go run` spent over two minutes downloading modules before the app started listening. Running `go mod download` beforehand took 25 s, and recording then worked. The docs include this step.

## Problems I hit

1. Microsoft Defender quarantined the native Windows build as `Trojan:Win32/Gracing.I` right after it downloaded from `keploy.io/ent/dl/latest/enterprise_windows_amd64.exe`. Running it in PowerShell then failed with `Operation did not complete successfully because the file contains a virus or potentially unwanted software.` I didn't override it. The tutorial leaves the detection name out; it stays here.
2. The open-source GitHub release (v3.6.86) only mocks HTTP and MySQL. Its banner is in `terminal/oss-build-banner.txt`.
3. The `keploy login` browser link expires after one minute: `authentication timed out after 1 minute; last polling error: unexpected status 401: {"error":"invalid or expired code"}`. My workspace role couldn't create a read-scope API key: `you do not hold the "read" scope; a token cannot be stronger than the person creating it`.
4. In Windows PowerShell 5.1, `curl` is `Invoke-WebRequest`: `A positional parameter cannot be found that accepts argument 'POST'.`
5. Port 8080 was already taken by another container: `listen tcp4 0.0.0.0:8080: bind: address already in use` (`terminal/ingress-port-in-use.txt`).
6. A request sent before the recorder is ready fails with `curl: (7) Failed to connect to localhost port 8080 after 0 ms: Connection refused`: `terminal/curl-refused.txt`.
7. Every record and test run logs `WARN agent pod cgroup slice unresolved`, which asks for `KEPLOY_POD_UID` (a Kubernetes setting). It didn't affect any result.
