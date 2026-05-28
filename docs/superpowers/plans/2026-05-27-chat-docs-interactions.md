# Chat And Document Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add always-visible company documents, sidebar history access, recipient switching, file mentions, and document create/upload flows.

**Architecture:** Keep this frontend-first and reuse the existing Zustand store plus `saveFileContent`. Put caret/file/recipient logic in tiny utility modules so Node's built-in test runner can verify it without adding a new test framework.

**Tech Stack:** Vite, React, Zustand, lucide-react, Node `node:test`.

---

### Task 1: Testable UI Helpers

**Files:**
- Create: `frontend/src/utils/chatInteractions.js`
- Create: `frontend/src/utils/documentInteractions.js`
- Test: `frontend/src/utils/chatInteractions.test.js`
- Test: `frontend/src/utils/documentInteractions.test.js`

- [ ] Write failing tests for mention extraction/insertion, recipient labels, filename normalization, and byte formatting.
- [ ] Run `node --test src/utils/*.test.js` from `frontend` and verify the tests fail because helpers are missing.
- [ ] Implement the helper modules with no React dependencies.
- [ ] Run `node --test src/utils/*.test.js` and verify the tests pass.

### Task 2: Sidebar History Entry Points

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`
- Create: `frontend/src/components/HistoryModal.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] Make Company Documents render outside the onboarding-gated block.
- [ ] Add a small hover-only clock button to Secretary, department, and project rows.
- [ ] Wire the button to a global `HistoryModal` state in `App.jsx`.
- [ ] Pass current `chatMessages`, `activeTab`, and file/project context into the modal for display.

### Task 3: Chat Recipient And Mentions

**Files:**
- Modify: `frontend/src/components/ChatPane.jsx`
- Modify: `frontend/src/store/workspaceStore.js`

- [ ] Fetch files when the chat mounts so mention suggestions are available before onboarding is complete.
- [ ] Add the lower-left recipient selector using existing `selectTab`.
- [ ] Add `@` mention dropup with mouse and keyboard selection.
- [ ] Use helper functions to insert `@filename` at the caret.

### Task 4: File Hub Create And Upload

**Files:**
- Modify: `frontend/src/components/FileHubPane.jsx`

- [ ] Add `+ New` and upload controls above the file list.
- [ ] Use `saveFileContent` to create or upload content.
- [ ] Refresh the file list and select the newly created/uploaded file.
- [ ] Show file sizes using helper formatting.

### Task 5: Verification

**Files:**
- Modify: `frontend/package.json`

- [ ] Add a `test:unit` script for Node tests.
- [ ] Run `npm run test:unit`.
- [ ] Run `npm run build`.
- [ ] Start the dev server and verify the UI loads in browser automation.
