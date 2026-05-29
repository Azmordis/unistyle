# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities through GitHub's private vulnerability
reporting: go to the **Security** tab of this repository and click
**"Report a vulnerability"**. This opens a private advisory visible only to the
maintainer.

Do not open a public issue for security reports.

You will receive an acknowledgement, and confirmed issues will be prioritized for a fix.

## Scope

UniStyle is a client-side Unicode text formatter shipped as a static web app and a
Chrome extension. There is no server, no account system, and no user data is
collected or transmitted. Reports most relevant to UniStyle: the extension's
permissions and content-script behavior, any XSS in the formatter input/output
handling, and the integrity of the published build.
