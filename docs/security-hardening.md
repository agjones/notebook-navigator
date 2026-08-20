# Security Hardening and Threat Model

This document defines the security posture of the `agjones/notebook-navigator` fork. It supplements the upstream
documentation and [`SECURITY.md`](../SECURITY.md); it is not a claim that the plugin is sandboxed or vulnerability-free.

The fork installs under the distinct Obsidian plugin ID `notebook-navigator-hardened`. This prevents Obsidian's
community-plugin update flow from confusing the fork with the upstream `notebook-navigator` package. Internal view,
icon, and settings-transfer identifiers retain their upstream values where compatibility requires it; the fork is
not intended to run alongside the upstream plugin in the same vault.

## Security goals

The fork is intended to:

- keep ordinary plugin operation local to the Obsidian vault;
- prevent settings, including imported or stale settings, from enabling unnecessary automatic network access or costly
  document parsers;
- reduce the risk that untrusted vault content can trigger script execution, external resource loading, or excessive
  parsing work;
- make dependency installation and release production narrow, reviewable, and reproducible;
- let an installer pin an exact release and verify both its checksums and GitHub build attestation; and
- preserve the useful local navigation, metadata, image, and vault-icon features of Notebook Navigator.

The fork does not attempt to sandbox Notebook Navigator from Obsidian, make an unreviewed build safe, or protect against
a compromised Obsidian installation or operating system.

## Fundamental trust boundary

An Obsidian community plugin is JavaScript loaded into Obsidian. It can use the APIs and host capabilities that Obsidian
and Electron expose, including reading and modifying vault files. A malicious `main.js` must therefore be treated as
arbitrary code.

Forking, reviewing, pinning, checksumming, and attesting the build reduce the chance that unexpected code reaches the
installed plugin. They do not constrain code that was intentionally included in a reviewed build. The trusted inputs
are the reviewed source commit, the locked build dependencies, the pinned CI definitions, GitHub's runner and
attestation service, the npm registry, Node.js distribution infrastructure, Obsidian, and the local operating system.

## Enforced runtime policy

`src/constants/securityPolicy.ts` exports a frozen, non-configurable policy. All five capabilities are denied:

| Capability | Hardened behavior |
| --- | --- |
| External feature images | No automatic download or caching of remote images or YouTube thumbnails |
| External icon packs | No provider activation, manifest download, font download, or metadata download |
| PDF thumbnails | No PDF cover parsing or thumbnail generation |
| Release checks | No automatic GitHub release API request |
| Remote release media | No remote welcome thumbnails, release banners, release videos, or YouTube thumbnails |

The corresponding user-facing defaults are also off. The policy is the security boundary: changing imported settings
alone cannot enable these paths. Any change to this file or to a call site guarded by it requires security review.

Local raster images and bounded, sanitized local SVG feature images remain supported. User-initiated links to support,
documentation, or tutorial pages remain possible. Property links are restricted to `https:`, `mailto:`, `sms:`, and
`tel:`; `http:`, `file:`, and arbitrary custom protocols are rejected.

## Untrusted input controls

The fork adds targeted limits around the most exposed local inputs:

- Vault SVG icons are capped at 200,000 source characters and 2,000 elements. Scriptable, animated, linking,
  embedding, filtering, and external-resource elements are removed, including `<use>`. Event handlers, classes,
  link-bearing attributes, and filter/mask/clip-path references are stripped. The sanitized SVG cache is capped at 200
  entries.
- Feature-image SVGs retain separate source-size and structural limits and are rasterized rather than rendered as live
  document DOM. Parsed and `<use>`-expanded element counts are bounded; reference cycles, embedded raster images, and
  `foreignObject` content are rejected.
- Settings files selected in the UI are capped at 1 MiB before parsing. Parsed settings are capped at 32 levels of
  nesting and 20,000 child values; unsupported and circular structures are rejected.
- External property links use the explicit protocol allowlist described above.

These controls reduce parser and resource-loading risk, but browser image/SVG parsers still process local vault data.
They should not be considered a formal parser sandbox.

## Dependency and toolchain controls

The audited toolchain is exact rather than a version range:

| Component | Pin |
| --- | --- |
| Node.js | `24.19.0` |
| npm | `11.17.0` |
| Node.js Linux x64 archive SHA-256 | `14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647` |
| Node.js macOS arm64 archive SHA-256 | `3f1cf157479c1480352083105e13faf9d008ede98e7e157746b6df940d197b94` |

All direct dependencies and development dependencies use exact versions. `package-lock.json` pins transitive versions,
registry URLs, and integrity hashes. `.npmrc` enforces the public npm registry, TLS, the lockfile, exact saves, strict
peer dependencies, and a seven-day minimum package age.

Lifecycle scripts are disabled during `npm ci` with `ignore-scripts=true`. The package-level script allowlist is a
second line of defense if scripts are deliberately re-enabled: only the pinned `esbuild@0.28.2` entry is allowed and
`fsevents` is denied. Build scripts resolve tools from `node_modules/.bin`; they do not use `npx` or fetch missing tools
on demand.

For a reviewed dependency update, run with the exact toolchain:

```sh
npm ci
npm audit signatures
npm audit --audit-level=high
npm run format:check
./scripts/build.sh
git diff --exit-code
```

Review the complete lockfile diff before accepting it. In particular, inspect new packages, source URLs, integrity
changes, lifecycle scripts, native binaries, maintainers/provenance, and newly introduced network, parser, filesystem,
process, or credential access.

## CI and release provenance

GitHub Actions are pinned to full commit SHAs. Checkout credentials are not persisted. Quality, CodeQL, dependency
review, and Scorecard workflows have narrow, explicit permissions.

The release workflow separates untrusted build work from privileged publishing:

1. A read-only build job downloads the exact Node.js archive and checks its SHA-256.
2. The job verifies the Node/npm versions, semantic version tag, matching package and manifest versions, and that the
   tagged commit belongs to `main`.
3. It installs the lockfile, verifies npm registry signatures, audits dependencies, and runs the complete build and test
   suite.
4. It emits only `main.js`, `manifest.json`, `styles.css`, release notes, and `SHA256SUMS` as a short-lived artifact.
5. A separate publish job, with no source checkout or dependency execution, attests the release artifacts and creates
   the GitHub release.

This layout prevents dependency or build code from running in the job that has release-write and attestation
credentials.

## Installing a pinned release

Install only an explicit semantic-version release from `agjones/notebook-navigator`; do not install from a moving branch
or an arbitrary locally built bundle. Download `main.js`, `manifest.json`, `styles.css`, and `SHA256SUMS` from the same
release, then verify them before copying them into the Obsidian plugin directory:

```sh
shasum -a 256 -c SHA256SUMS

version='3.3.4'
source_digest='83181086f9f841e98a28c9887ca0ef002b42d45b'
for artifact in main.js manifest.json styles.css SHA256SUMS; do
    gh attestation verify "$artifact" \
        --repo agjones/notebook-navigator \
        --signer-workflow agjones/notebook-navigator/.github/workflows/release.yml \
        --source-ref "refs/tags/$version" \
        --source-digest "$source_digest" \
        --signer-digest "$source_digest" \
        --deny-self-hosted-runners \
        --format json --jq 'length'
done
```

Replace `version` and `source_digest` with the exact reviewed tag and peeled tag commit for future releases. Requiring
only the repository identity is insufficient when more than one run has attested byte-identical artifacts; the source
commit, tag ref, signer workflow, signer commit, and GitHub-hosted runner must also match. Each command above must exit
successfully and print exactly `1`.

Record the installed semantic version, source commit, and verified hashes. Do not use Obsidian's Community Plugins
"Update all" flow for this fork; install a newly verified fork release deliberately because every update is a new
arbitrary-code trust decision.

The verified files belong in `.obsidian/plugins/notebook-navigator-hardened/`. Do not rename that directory or edit the
release `manifest.json`; the directory name must continue to match the manifest plugin ID.

## Network behavior

Automatic requests for release checks, external feature images, external icon packs, and remote welcome/release media
are disabled. The dormant upstream implementations remain in the source tree behind the frozen policy, so guard changes
must be reviewed as security-sensitive.

The plugin can still cause network activity when the user explicitly opens an external support, documentation,
tutorial, or allowed property link. This document describes Notebook Navigator only; Obsidian itself, embedded web
content, themes, and other plugins have separate network behavior.

Startup debug logging remains an optional local feature. It writes a diagnostic Markdown file in the vault and does not
upload it. Review and redact diagnostic files before sharing them because paths, identifiers, or stack details may be
present and vault sync may copy the file elsewhere.

## Accepting upstream changes

Do not merge or rebase upstream changes blindly. For every update:

1. Pin the exact upstream commit and review the source diff before executing its build or install instructions.
2. Review changes to `package.json`, `package-lock.json`, `.npmrc`, build scripts, GitHub workflows, action SHAs, and the
   Node.js archive hashes before running `npm ci`.
3. Reject floating action tags, version ranges, `npx`, remote bootstrap scripts, unverified binary downloads, broad
   workflow permissions, or build steps that receive publish credentials.
4. Search for new network clients, URL construction, external media, HTML/SVG rendering, PDF or archive parsing,
   filesystem/process APIs, dynamic evaluation, and settings-import paths.
5. Confirm every hardened policy guard and its tests remain intact, then run dependency verification, static analysis,
   tests, and a production build.
6. Tag only a reviewed commit already on `main`, with the tag exactly matching both `package.json` and `manifest.json`.
7. Install only after the release checksums and attestations verify.

When changing Node.js, obtain the new archive digest from the official Node.js `SHASUMS256.txt`, verify that file's
signature through the Node.js release process, and update each workflow and this document in the same reviewed change.

## Audit baseline and residual risk

The initial hardening review on 2026-08-20 started from upstream commit
`114bc6e4da97556ca48b80f36f071caa7c9e153f`. At that point, the full suite passed 2,017 tests across 174 test files, the
complete build finished with zero warnings, npm reported no known dependency vulnerabilities, installed package
signatures verified, and two isolated network-denied builds produced identical plugin artifacts. Release checksums are
the authoritative artifact identifiers; snapshot hashes are intentionally not copied into this living document.

Remaining risks include:

- the plugin is arbitrary code with Obsidian/Electron capabilities, not a sandboxed extension;
- the dormant upstream network implementations could become reachable if a future change bypasses the frozen policy;
- local browser image and SVG parsers still process bounded vault content;
- user-invoked file drops and other large local files can still create availability pressure;
- the build trusts the reviewed lockfile plus Node.js, npm, GitHub-hosted runners, GitHub Actions, the npm registry, and
  GitHub's attestation service; and
- the PowerShell build path was statically reviewed but was not executed during the initial macOS audit, and fork CI
  results do not exist until the hardened branch is pushed.

No arbitrary command execution, dynamic evaluation, raw-HTML injection, path traversal, or archive-extraction issue was
confirmed during the initial review. That is a review result, not proof that no such vulnerability exists.

## Repository settings not enforced by this code

Repository administration is part of the security boundary. Before treating the release process as production-ready:

- enable dependency vulnerability alerts and security updates;
- protect `main` against force-push and deletion and require the quality, CodeQL, and dependency-review checks;
- require pull-request review for workflow, lockfile, policy, and release changes;
- restrict allowed Actions and enforce full-SHA pinning where GitHub settings support it; and
- consider requiring signed commits and protected, signed release tags.

These settings must be verified in GitHub. Their appearance in this document does not mean they are currently enabled.
