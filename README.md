# Aueron Remote

A private remote-access hub for my own computers, built on [MeshCentral](https://github.com/Ylianst/MeshCentral),
with a hardened layer that lets **AI agents operate the PCs through MCP** (Model Context Protocol):
list devices, run PowerShell with a verified exit code, move files with SHA-256 checks.

The remote desktop, terminal and file engine are MeshCentral's (Apache-2.0) and are **not** in this
repository. What is here is the part I designed and had AI coding agents build around it:

| Part | File | What it does |
|---|---|---|
| MCP server | `scripts/aueron-mcp.mjs` | Exposes `list_devices`, `device_info`, `run_powershell`, `upload_file`, `download_file` to Claude Code / Codex over stdio |
| Operations | `scripts/ai-operations.mjs` | Wraps every remote command in an encoded PowerShell envelope with a per-call nonce marker, so a command only counts as done when its real exit code comes back. Uploads refuse to overwrite and verify SHA-256 on the remote side; downloads go to a temp file and are hash-checked before landing |
| Protected CLI | `scripts/meshctrl-protected.cjs` | Runs the upstream `meshctrl` in-process with an **allow-list of actions**, blocks arguments that would redirect the target or credentials, restores full TLS certificate + hostname validation on all three transports, and keeps the password out of the process command line |
| Identity | `scripts/provision-ai.mjs`, `Aueron-AI.ps1` | Creates a dedicated non-admin `aueron-ai` account with terminal and file rights only (no desktop), stores its password with Windows DPAPI for the current user, and hands it to the CLI on stdin |
| Configuration | `scripts/configure.mjs`, `scripts/activate-tailnet.mjs` | Generates a MeshCentral config bound to loopback only, no self-registration, no login tokens; publishes it privately on the Tailscale network (never Funnel), with backup and automatic rollback |
| Supply chain | `scripts/prepare-upstream.mjs`, `scripts/restore-official-host.mjs` | Exact-text patch of one vulnerable upstream dependency pin, and restore of the official agent binary verified against the npm lockfile integrity and a pinned SHA-256 |
| Desktop app | `app/AueronRemote.cs` | Small Windows launcher (WinForms, built with the .NET Framework compiler) |
| Web skin | `web/` | Custom CSS/JS for the MeshCentral web UI, including deep links that open a PC's desktop or terminal directly |

## Design rules

- The AI never sees or passes credentials: identity and target are fixed by the launcher, not by arguments.
- Every write is non-destructive by default (no overwrite on upload or download, no config rewrite).
- An operation without a confirmed remote exit code is reported as **not confirmed**, never as success.
- Upstream code on disk stays untouched; adaptations are applied in memory and only after an exact match
  check against the verified upstream version (MeshCentral 1.2.5).

## Tests

```bash
npm install
npm test
```

`node --test` covers the exit-marker protocol, the PowerShell wrapper (success, native failure, explicit exit,
thrown error), the argument allow-list, identity validation and the TLS hardening of the upstream CLI, and the
generated configuration.

## Notes

The interface strings and code comments are in Italian. Machine names, addresses and accounts of the real
installation are not part of this repository. See [NOTICE.md](NOTICE.md) for third-party components.

## License

MIT for the code in this repository. MeshCentral and the other dependencies keep their own licenses.
