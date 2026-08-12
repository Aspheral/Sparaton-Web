# Repository Safety Recommendations

These settings are recommendations for the repository owner. They are not silently applied because branch-protection changes can lock out the current owner workflow.

For `main`, enable branch/ruleset protections when the owner is ready to require pull requests:

- block force pushes
- block branch deletion
- require the CI checks named `Static and type checks`, `Unit and integration tests`, `Isolated D1 migrations`, `Production builds`, and `Browser and E2E tests`
- require branches to be up to date before merge if the collaboration volume makes that useful
- require conversation resolution for reviewed pull requests
- allow the repository owner an intentional administrative bypass rather than creating an accidental lockout

Security settings recommended for the public repository:

- GitHub secret scanning and push protection
- Dependabot security updates
- dependency graph / vulnerability alerts
- private vulnerability reporting if desired

`CODEOWNERS` keeps the repository owner visible on broad changes but does not itself force approval. If additional maintainers join later, narrow ownership by app or package rather than assigning every path to a large team.

Never store Cloudflare, Resend, Access, GitHub, D1, or R2 secrets in repository files or Actions artifacts. Use GitHub/Cloudflare secret stores and scoped credentials.
