# Taste
- Works in a multi-tool/multi-model loop: makes commits with other AI tools (e.g., "muse spart model on opecode"), then returns to this agent. Reconstruct state by reading context files (CLAUDE.md, README, handoff/spec folders) and recent git history (diffs of commits made elsewhere) before acting — never assume prior-session state. Confidence: 0.8
- Wants comprehensive task completion: when a spec/assignment folder exists, complete ALL its tasks/conditions in one pass, not just the reported bug. Confidence: 0.7
- Expects bugs to be root-caused and verified before/after fixing (reproduce, lint, build), not blindly patched. Confidence: 0.6
- Reports bugs tersely — pastes only an error code/digest (e.g., "ERROR 4263568130") with no stack or steps; expects the agent to hunt down the underlying error itself (server logs, reproduction, production checks). Confidence: 0.7
- When analyzing a new assignment/spec, wants a plain-language breakdown before any coding: what kind of system is required, every mandatory feature listed explicitly (including scoring weightings), explained in easy/simple language yet fully detailed, ending with a one-line summary. Confidence: 0.7
- Wants UI/UX polish proactively bundled with functional work ("improve ui/ux design also"), not only when explicitly asked as the sole task. Confidence: 0.7
