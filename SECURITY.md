# Security Policy

## Hardened Fork

This repository maintains a security-hardened personal fork of Notebook Navigator. Its security goals, threat model,
enforced runtime restrictions, dependency controls, release provenance, verification commands, and residual risks are
documented in [Security Hardening and Threat Model](docs/security-hardening.md).

The hardening reduces exposed attack surface; it does not sandbox the plugin. Obsidian community plugins execute
JavaScript with the privileges made available by Obsidian and Electron, so source and build provenance remain security
boundaries.

## Supported Versions

Security fixes are handled for the latest published Notebook Navigator release. Older releases are not maintained
separately.

## Reporting a Vulnerability

Please report security issues in this fork through GitHub private vulnerability reporting:

https://github.com/agjones/notebook-navigator/security/advisories/new

If private reporting is unavailable, open a public issue asking for a private reporting channel and do not include
exploit details.

Include the affected Notebook Navigator version, Obsidian version, platform, reproduction steps, and any relevant sample
vault data.

Security reports are reviewed before public disclosure. Fix timing depends on impact and release scope.

If a report also affects the upstream project, coordinate disclosure rather than publishing exploit details in either
repository.
