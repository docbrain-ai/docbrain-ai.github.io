# Real captures for the "Not a mockup" section

The `#real` section on the homepage stays completely hidden until at least one
of these files exists. Drop a file in, it appears. Remove it, it disappears.
No HTML changes needed.

| File | What to capture |
|---|---|
| `claude-code.png` | A Claude Code session where `docbrain_ask` returns a cited answer and declares a gap. Include the prompt and the citations. |
| `cursor.png` | The Cursor chat panel with DocBrain answering over MCP, citations visible. |
| `github.png` | A pull request where `@docbrain` was mentioned and replied with citations. |
| `slack.png` | A thread where `@docbrain` answered, ideally showing a live read alongside the indexed record. |

## Framing

- **16:10**, around 1600x1000. Larger is fine, it is scaled down.
- The box uses `object-fit: cover` anchored **top left**, so anything below the
  16:10 crop is cut. Put the important content at the top.
- Capture at 2x if your display allows it. Text stays crisp when scaled down.

## Before you add one

These images ship publicly. Nothing in them may show an employer or customer
identifier: no company name, internal hostnames, real Jira project keys,
cluster or service names, or a work email. Use the local instance and its own
record. Check the window title, the shell prompt, the tab bar, any sidebar and
any notification that happens to be on screen.
