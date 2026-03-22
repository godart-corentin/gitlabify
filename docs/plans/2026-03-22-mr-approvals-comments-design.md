# Design: MR Approval Count & Unresolved Discussion Count

**Date:** 2026-03-22
**Scope:** "mrs" tab (authored MRs only)

## Problem

The MR card in the "mrs" tab shows ID, title, author, branch, and last updated time. It lacks approval and discussion status, which makes it hard to gauge the health of an MR at a glance.

## Goal

Display on each authored MR card:

- The number of approvals received
- The number of unresolved discussion threads

## Approach

Extend the existing inbox service to fetch approval and discussion data for authored MRs alongside the current reviewer-MR fetches. Store counts as new fields on the `MergeRequest` model and render them in the `InboxItem` component only when the "mrs" filter is active.

---

## Backend (Rust)

### New models (`models.rs`)

Add structs to deserialize the GitLab `/discussions` response:

```rust
struct DiscussionNote { resolvable: Option<bool>, resolved: Option<bool> }
struct Discussion { notes: Vec<DiscussionNote> }
```

Add two fields to `MergeRequest` (with `#[serde(default)]` so existing deserialization is unaffected):

```rust
approval_count: u32,
unresolved_discussion_count: u32,
```

### New API method (`client.rs`)

`fetch_merge_request_discussions(project_id, iid) -> Result<Vec<Discussion>, GitLabError>`

Calls: `GET /api/v4/projects/{id}/merge_requests/{iid}/discussions`

### Extended fetch logic (`client.rs`)

In the existing loop over `all_mrs` in `fetch_merge_requests`, add a branch for authored MRs (where `author.id == user_id`) that concurrently fetches approvals and discussions using `tokio::join!`:

- `/approvals` → `mr.approval_count = approvals.approved_by.len() as u32`
- `/discussions` → `mr.unresolved_discussion_count = threads where any note has resolvable=true && resolved=false`

Errors are soft-skipped with a `warn!` log, same as the existing reviewer fetch pattern.

---

## Frontend (TypeScript)

### Schema (`src/entities/inbox/model/schemas/project.ts`)

Add to `MergeRequestSchema`:

```typescript
approvalCount: num(),
unresolvedDiscussionCount: num(),
```

### Card component (`src/entities/inbox/ui/InboxItem.tsx`)

Add optional props:

```typescript
approvalCount?: number
unresolvedDiscussionCount?: number
```

Render in the right-side section (before the timestamp), only when the value is > 0:

- Approvals: small muted-green label, e.g. `✓ 2`
- Unresolved: small muted-amber label, e.g. `⊙ 3`

### List component (`src/widgets/inbox-dashboard/ui/InboxItemList.tsx`)

When `filter === "mrs"`, pass `approvalCount` and `unresolvedDiscussionCount` from `mr` to `<InboxItem>`.

---

## API calls added per poll cycle

For each authored MR (typically 0–10):

- `GET /projects/{id}/merge_requests/{iid}/approvals`
- `GET /projects/{id}/merge_requests/{iid}/discussions`

Both are fetched concurrently via `tokio::join!` and run in the background poller, so they are non-blocking from the user's perspective.

---

## Out of scope

- Showing counts on notifications or reviewer MRs
- Required approval threshold (e.g. "2/3")
- Resolved discussion count
- Per-user approval details
