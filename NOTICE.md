# Third-party components

The remote engine is **MeshCentral 1.2.5** (Apache License 2.0):
https://github.com/Ylianst/MeshCentral — https://github.com/Ylianst/MeshCentral/blob/master/LICENSE

The hub web interface, remote desktop, remote terminal and file transfer are MeshCentral features. They are not
part of this repository and are not presented as original code. Upstream licences stay with their packages.

MCP integration: `@modelcontextprotocol/sdk` 1.30.0 and Zod 4.6.5 (MIT). `scripts/meshctrl-protected.cjs` adapts
MeshCtrl 1.2.5 in memory: it restores standard TLS verification on all three transports and handles missing network
metadata for limited-permission identities. Upstream code on disk is left untouched, and every adaptation is applied
only after an exact-text check.

Reproducible local change to the upstream file `meshcentral.js`: `scripts/prepare-upstream.mjs` replaces only the
runtime pin `node-windows@0.1.14` with `node-windows@1.0.0-beta.8`, keeping the headers and marking the change in the
source. Reason: GHSA-53xv-c2hx-5w6q (the new module also drops the old optimist/minimist dependency). The patch checks
the MeshCentral version and the exact text before applying, and must be re-evaluated on upgrades.
