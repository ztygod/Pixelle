# Security Policy

Pixelle Agent can execute tools that read files, write files, access the
network, or run shell commands when permissions allow it. Treat security bugs
in workspace isolation, command policy, path handling, tool permissions, and
provider credential handling as high priority.

## Supported Versions

Security updates are provided for the latest published minor version once the
package is released on npm.

## Reporting a Vulnerability

Please do not open public issues for vulnerabilities. Report suspected
security problems privately to the maintainers with:

- affected version or commit
- reproduction steps
- expected and actual impact
- relevant config and tool permissions

The project will acknowledge valid reports, coordinate a fix, and publish a
patched release when appropriate.
