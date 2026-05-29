# Changelog

All notable changes to the Beo Solopreneur OS project are documented in this file.

## [1.2.0] - 2026-05-29

### Added
- **Central System Log Panel (`LogPane`)**:
  - Unified system console displaying terminal command executions, AI workflow steps, swarm member progress, and watchdog heartbeat logs.
  - Interactive terminal window rendering output (stdout/stderr) and tracebacks for failed commands.
  - Filter by category (All, Terminal, Workflows, Swarms, Heartbeats) and execution status.
  - Interactive **Watchdog Health Board** displaying real-time statuses (Healthy, Nudged, Escalated, Failed) for all custom AI employee roles.
  - Rerun/Retry actions directly on failed workflow steps or swarm member processes.
- **Swarm Dashboard Enhancement**:
  - Live employee cards showing individual agent workloads and uptime.
  - Simulated operational charts (Uptime, API Error Rates, Worked Hours).
  - Interactive hierarchical organizational chart mapping bot collaboration structure.
- **Interactive Chat Member Status Panel**:
  - Top-right chat members popover showing real-time agent state indicators (Online, Problems, Offline).
- **Inline Message Approvals**:
  - Intercepted sensitive tool recommendations (such as file edits, command execution, or meeting creation) and rendered them as clear, inline decision cards (Approve/Reject buttons) in the chat window.
- **Real-Time Drafting Indicators**:
  - Real-time typing indicators in chat channels showing when an agent is compiling or drafting replies (e.g., `@{name} is typing...`).
- **Interactive Document Viewer & Preview split-screen**:
  - Split-screen workspace layout that opens Markdown documents and slides directly within the active chat workspace.
  - Wider/larger document view width configuration for improved readability.
- **Cloning & Slide Deck Agent Integration**:
  - Slide Agent capable of compiling HTML, converting to PowerPoint, and rendering presentation files inside the shared document panel.
- **Agent Mention (@) support**:
  - Added `@role` and `@All` tag handling in chat channels to direct commands to specific swarms or department agents.

### Changed
- **Sequential Swarm Chat Processing**:
  - Swarm replies now execute sequentially with clean turn-taking to prevent concurrent reply noise.
- **C-Suite Multi-Instance Protection**:
  - Restricted C-level roles (CEO, COO, CTO) to single instance execution to maintain system leadership structure.
- **Inbox Queue Dynamic Island**:
  - Removed floating inbox queue UI elements in favor of streamlined inline approval cards.
- **Auto-Open Meetings**:
  - Enabled instant rendering and redirection to newly created emergency or standard team swarms.

### Fixed
- **FastAPI Multipart Support**:
  - Added `python-multipart` backend dependency to resolve file upload and form parsing runtime errors.
- **Swarm Blocker Propagation Bug**:
  - Resolved an issue where successive swarm members repeated previous blocking state logs.
- **Windows Command Build Resolution**:
  - Resolved `powershell` execution directory resolution error during `npm run build` by enforcing execution at project root.
