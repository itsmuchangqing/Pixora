# Security Policy

## Supported versions

Only the latest 1.x release is supported with security updates.

## Reporting a vulnerability

Please use GitHub's **private security advisory** feature for this repository.
Do not open a public issue for an unpatched vulnerability.

Include:

- affected version or commit;
- browser and operating system;
- reproduction steps;
- expected and actual behavior;
- impact assessment, if known.

## Scope

Pixora processes images locally in the browser. The web app does not upload
user images to the API. The Express API is an optional skeleton and the
`POST /api/pixelate` endpoint currently returns `501 Not Implemented`.

If a future change introduces server-side uploads, storage, accounts or
third-party services, the security and privacy documentation must be updated
in the same change.
