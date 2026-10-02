# Run notes

These notes are what I wrote down while running both Keploy Go quickstarts on 2 October 2026. Every command and output in the tutorial comes from these runs.

## Setup

- Windows 11 Home host with Docker Desktop 29.7.2. Docker Desktop's Linux VM runs the WSL2 kernel 6.18.40.1-microsoft-standard-WSL2.
- The clean run happened in a privileged Ubuntu 22.04 container on that kernel, with Go 1.24.2. It used the host network and ran as root. On a normal Ubuntu or WSL2 install, the installer uses `sudo` to move `keploy` into `/usr/local/bin`, so it may ask for your password.
- I installed Keploy with `curl --silent -O -L https://keploy.io/install.sh && source install.sh`, which installed **Keploy 3.8.58**. The capture is in `terminal/01-install.ansi`.
- Databases came from each sample's `docker compose` file: `mongo` resolved to **MongoDB 9.0.2** (`mongod --version`), and Postgres is `postgres:10.5`.
- Samples: `keploy/samples-go` at commit `2b0a034` (2026-09-04).

## What I ran, in order

Each run has a raw capture in `terminal/`. The `.ansi` file is the output and the `.tm` file is its timing, both recorded with `script --log-timing`.

| Capture | Command |
|---|---|
| 01-install | `curl --silent -O -L https://keploy.io/install.sh && source install.sh` |
| 02-login | `keploy login` (approved in the browser) |
| 03-clone | `git clone https://github.com/keploy/samples-go.git` |
| 10-gin-record | `keploy record -c "go run main.go handler.go"`, then Ctrl+C |
| 11-gin-post / 12-gin-get | the two `curl` requests from a second terminal |
| 20-gin-test | `keploy test -c "go run main.go handler.go" --delay 10` with MongoDB stopped |
| 30-gin-break | same, after changing `StatusSeeOther` to `StatusMovedPermanently` |
| 31-gin-nonoise | same, after deleting `body.ts: []` from the test file |
| 32-gin-globalnoise | same, with `body.ts` only in `keploy.yml` under `test.globalNoise.global` |
| 05-echo-build | `go build -o echo-psql-url-shortener .` |
| 40-echo-record, 41/42 | `keploy record -c "./echo-psql-url-shortener"` and the two requests |
| 50-echo-test | `keploy test -c "./echo-psql-url-shortener" --delay 10` with Postgres stopped |
| 60-echo-break | same, after changing `StatusPermanentRedirect` to `StatusTemporaryRedirect` and rebuilding |
| 61-echo-nonoise | same, after deleting `body.ts: []` |

Before the Gin run I did `rm -rf keploy`, `sed -i 's/mongoDb:27017/localhost:27017/' main.go` and `docker compose up -d mongo`. Before the Echo run I did `rm -rf keploy`, `sed -i 's/host: "postgresDb"/host: "localhost"/' main.go` and `docker compose up -d postgres`. Their output is in `terminal/docker-compose.txt`.

For the break step, my captured run used a longer `sed` expression that replaced the whole `c.Redirect(...)` call. The tutorial shows the shorter form. Each constant appears only once in its `handler.go`, so both make the same edit.

## Results

| | Gin + MongoDB | Echo + PostgreSQL |
|---|---|---|
| Recorded | `post-url-1`, `get-7fvpssfg-1` | `post-url-1`, `get-4kepjktt-1` |
| Auto-replay after Ctrl+C | 2/2 passed | 2/2 passed |
| `keploy test`, database stopped | 2/2 passed, 10.17 s | 2/2 passed, 10.13 s |
| Break it | 1 failed: expected 303, got 301 | 1 failed: expected 308, got 307 |
| Noise rule removed | 1 failed on `ts` | 1 failed on `ts` |

The generated files are in `gin-mongo/` and `echo-sql/`. Keploy's own `keploy/.gitignore` (`/reports/`, `/*/mocks.yaml`) is left out here, so the mocks stay visible.

## Problems I hit

1. Microsoft Defender quarantined the native Windows build as `Trojan:Win32/Gracing.I` right after downloading it from `keploy.io/ent/dl/latest/enterprise_windows_amd64.exe`. I did not override it.
2. The open-source GitHub release (v3.6.86) only mocks HTTP and MySQL. Its banner is in `terminal/oss-build-banner.txt`.
3. The `keploy login` browser link expires after one minute: `authentication timed out after 1 minute; last polling error: unexpected status 401: {"error":"invalid or expired code"}`. My workspace role could not create a read-scope API key: `you do not hold the "read" scope; a token cannot be stronger than the person creating it`.
4. In Windows PowerShell 5.1, `curl` is `Invoke-WebRequest`: `A positional parameter cannot be found that accepts argument 'POST'.`
5. In an earlier run, the echo-sql sample's shipped `test-set-0` crashed replay: `replayer: session RecordedIndex missing PostgresV3Session mock — cannot reply to StartupMessage`.
6. Port 8080 was already taken by another container: `terminal/ingress-port-in-use.txt`.
7. A request sent before the recorder is ready fails with `curl: (7) ... Connection refused`: `terminal/curl-refused.txt`.
