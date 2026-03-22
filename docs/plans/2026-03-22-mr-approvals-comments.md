# MR Approval & Unresolved Discussion Counts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show approval count and unresolved discussion count on authored MR cards in the "mrs" tab.

**Architecture:** Add two new fields (`approval_count`, `unresolved_discussion_count`) to the Rust `MergeRequest` model; fetch them from the GitLab API for authored MRs in the existing `fetch_merge_requests` loop; surface them through the TypeScript schema and render them in `InboxItem`.

**Tech Stack:** Rust (Tauri v2), TypeScript, React 19, sibyl-ts (schema validation), lucide-react (icons), Vitest (frontend tests), `cargo test` (Rust tests).

---

### Task 1: Add Discussion model and new fields to MergeRequest (Rust)

**Files:**
- Modify: `src-tauri/src/modules/gitlab/models.rs`

**Step 1: Add `Discussion` and `DiscussionNote` structs**

In `models.rs`, add after the `MergeRequestReviewerStatus` struct at the bottom:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct DiscussionNote {
    #[serde(default)]
    pub(crate) resolvable: bool,
    #[serde(default)]
    pub(crate) resolved: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct Discussion {
    pub(crate) notes: Vec<DiscussionNote>,
}
```

**Step 2: Add new fields to `MergeRequest`**

In the `MergeRequest` struct, add two fields after `reviewed_by_me`:

```rust
    #[serde(default)]
    pub(crate) approval_count: u32,
    #[serde(default)]
    pub(crate) unresolved_discussion_count: u32,
```

**Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src-tauri/src/modules/gitlab/models.rs
git commit -m "feat(backend): add approval_count and unresolved_discussion_count fields to MergeRequest"
```

---

### Task 2: Add `fetch_merge_request_discussions` and `count_unresolved_discussions` with tests

**Files:**
- Modify: `src-tauri/src/modules/gitlab/client.rs`
- Modify: `src-tauri/src/modules/gitlab/mod.rs` (if Discussion needs to be re-exported)

**Step 1: Write a failing test for `count_unresolved_discussions`**

In `client.rs`, inside the existing `#[cfg(test)]` module at the bottom, add:

```rust
#[test]
fn counts_unresolved_discussion_threads() {
    use crate::modules::gitlab::models::{Discussion, DiscussionNote};

    let discussions = vec![
        // resolvable and unresolved → counts
        Discussion {
            notes: vec![DiscussionNote { resolvable: true, resolved: false }],
        },
        // resolvable and resolved → does not count
        Discussion {
            notes: vec![DiscussionNote { resolvable: true, resolved: true }],
        },
        // not resolvable (system note) → does not count
        Discussion {
            notes: vec![DiscussionNote { resolvable: false, resolved: false }],
        },
        // empty notes → does not count
        Discussion { notes: vec![] },
    ];

    assert_eq!(count_unresolved_discussions(&discussions), 1);
}

#[test]
fn counts_zero_when_all_discussions_resolved() {
    use crate::modules::gitlab::models::{Discussion, DiscussionNote};

    let discussions = vec![
        Discussion {
            notes: vec![DiscussionNote { resolvable: true, resolved: true }],
        },
        Discussion {
            notes: vec![DiscussionNote { resolvable: true, resolved: true }],
        },
    ];

    assert_eq!(count_unresolved_discussions(&discussions), 0);
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test counts_unresolved -- --nocapture
```

Expected: compile error — `count_unresolved_discussions` not found.

**Step 3: Add `count_unresolved_discussions` helper function**

In `client.rs`, add near the bottom alongside `did_user_review_mr`:

```rust
fn count_unresolved_discussions(discussions: &[Discussion]) -> u32 {
    discussions
        .iter()
        .filter(|d| d.notes.iter().any(|n| n.resolvable && !n.resolved))
        .count() as u32
}
```

**Step 4: Add `Discussion` to the imports in `client.rs`**

Update the existing import line for models:

```rust
use super::models::{
    Author, Discussion, MergeRequest, MergeRequestApprovals, MergeRequestReviewerStatus, Pipeline, Todo,
};
```

**Step 5: Add `fetch_merge_request_discussions` method**

In the `GitLabClient` impl block, add after `fetch_merge_request_reviewers`:

```rust
pub(crate) async fn fetch_merge_request_discussions(
    &self,
    project_id: u64,
    merge_request_iid: u64,
) -> Result<Vec<Discussion>, GitLabError> {
    let url = format!(
        "{}/api/v4/projects/{}/merge_requests/{}/discussions",
        self.host, project_id, merge_request_iid
    );
    self.get_json::<Vec<Discussion>>(&url).await
}
```

**Step 6: Run tests to verify they pass**

```bash
cd src-tauri && cargo test counts_unresolved -- --nocapture
```

Expected: 2 tests pass.

**Step 7: Commit**

```bash
git add src-tauri/src/modules/gitlab/client.rs
git commit -m "feat(backend): add fetch_merge_request_discussions and count_unresolved_discussions"
```

---

### Task 3: Extend `fetch_merge_requests` to fetch counts for authored MRs

**Files:**
- Modify: `src-tauri/src/modules/gitlab/client.rs`

Context: The existing loop at the bottom of `fetch_merge_requests` (around line 95) iterates `all_mrs` and handles reviewer MRs:

```rust
for mr in &mut all_mrs {
    if !mr.is_reviewer {
        continue;
    }
    // ... fetches approvals and reviewers
}
```

We need to add an `else if` branch for authored MRs.

**Step 1: Write a failing test for MergeRequest deserialization with new default fields**

In the existing `merge_request_deserialization` test in `client.rs`, add assertions after the existing ones:

```rust
assert_eq!(mr.approval_count, 0);
assert_eq!(mr.unresolved_discussion_count, 0);
```

**Step 2: Run the test to confirm it passes (fields already have defaults)**

```bash
cd src-tauri && cargo test merge_request_deserialization -- --nocapture
```

Expected: PASS (the `#[serde(default)]` already handles this).

**Step 3: Extend the fetch loop**

Change the loop in `fetch_merge_requests` from:

```rust
for mr in &mut all_mrs {
    if !mr.is_reviewer {
        continue;
    }
    // ... existing reviewer block
}
```

To:

```rust
for mr in &mut all_mrs {
    if mr.is_reviewer {
        let (approvals_result, reviewers_result) = tokio::join!(
            self.fetch_merge_request_approvals(mr.project_id, mr.iid),
            self.fetch_merge_request_reviewers(mr.project_id, mr.iid)
        );

        match approvals_result {
            Ok(approvals) => {
                mr.approved_by_me = approvals
                    .approved_by
                    .iter()
                    .any(|entry| entry.user.id == user_id);
            }
            Err(GitLabError::Unauthorized) => {
                warn!(
                    target: "gitlabify::gitlab",
                    project_id = mr.project_id,
                    iid = mr.iid,
                    "approvals unauthorized; skipping"
                );
            }
            Err(error) => {
                warn!(
                    target: "gitlabify::gitlab",
                    project_id = mr.project_id,
                    iid = mr.iid,
                    %error,
                    "approvals fetch error; skipping"
                );
            }
        }

        match reviewers_result {
            Ok(reviewers) => {
                mr.reviewed_by_me = did_user_review_mr(&reviewers, user_id);
            }
            Err(GitLabError::Unauthorized) => {
                warn!(
                    target: "gitlabify::gitlab",
                    project_id = mr.project_id,
                    iid = mr.iid,
                    "reviewers unauthorized; skipping"
                );
            }
            Err(error) => {
                warn!(
                    target: "gitlabify::gitlab",
                    project_id = mr.project_id,
                    iid = mr.iid,
                    %error,
                    "reviewers fetch error; skipping"
                );
            }
        }
    } else if mr.author.id == user_id {
        let (approvals_result, discussions_result) = tokio::join!(
            self.fetch_merge_request_approvals(mr.project_id, mr.iid),
            self.fetch_merge_request_discussions(mr.project_id, mr.iid)
        );

        match approvals_result {
            Ok(approvals) => {
                mr.approval_count = approvals.approved_by.len() as u32;
            }
            Err(GitLabError::Unauthorized) => {
                warn!(
                    target: "gitlabify::gitlab",
                    project_id = mr.project_id,
                    iid = mr.iid,
                    "approvals unauthorized; skipping"
                );
            }
            Err(error) => {
                warn!(
                    target: "gitlabify::gitlab",
                    project_id = mr.project_id,
                    iid = mr.iid,
                    %error,
                    "approvals fetch error; skipping"
                );
            }
        }

        match discussions_result {
            Ok(discussions) => {
                mr.unresolved_discussion_count = count_unresolved_discussions(&discussions);
            }
            Err(GitLabError::Unauthorized) => {
                warn!(
                    target: "gitlabify::gitlab",
                    project_id = mr.project_id,
                    iid = mr.iid,
                    "discussions unauthorized; skipping"
                );
            }
            Err(error) => {
                warn!(
                    target: "gitlabify::gitlab",
                    project_id = mr.project_id,
                    iid = mr.iid,
                    %error,
                    "discussions fetch error; skipping"
                );
            }
        }
    }
}
```

**Step 4: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

**Step 5: Run all Rust tests**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add src-tauri/src/modules/gitlab/client.rs
git commit -m "feat(backend): fetch approval and discussion counts for authored MRs"
```

---

### Task 4: Update TypeScript MergeRequest schema

**Files:**
- Modify: `src/entities/inbox/model/schemas/project.ts`

**Step 1: Add fields to `MergeRequestSchema`**

In `project.ts`, add two fields after `reviewedByMe`:

```typescript
  approvalCount: num(),
  unresolvedDiscussionCount: num(),
```

The full schema object should now end with:

```typescript
  isReviewer: bool(),
  approvedByMe: bool(),
  reviewedByMe: bool(),
  approvalCount: num(),
  unresolvedDiscussionCount: num(),
```

**Step 2: Verify TypeScript compiles**

```bash
bun run typecheck   # or: npx tsc --noEmit
```

If `typecheck` script doesn't exist, check `package.json` for the correct script name. If none, skip — it will be caught at build time.

**Step 3: Commit**

```bash
git add src/entities/inbox/model/schemas/project.ts
git commit -m "feat(frontend): add approvalCount and unresolvedDiscussionCount to MergeRequest schema"
```

---

### Task 5: Update `InboxItem` to display counts

**Files:**
- Modify: `src/entities/inbox/ui/InboxItem.tsx`

**Step 1: Add new props to `InboxItemProps`**

In the `InboxItemProps` type, add after `onMarkAsDone`:

```typescript
  approvalCount?: number;
  unresolvedDiscussionCount?: number;
```

**Step 2: Destructure the new props in the function signature**

Add to the destructured params:

```typescript
  approvalCount,
  unresolvedDiscussionCount,
```

**Step 3: Add icons import**

Update the lucide-react import to include `ThumbsUp` and `MessageCircle`:

```typescript
import { Check, Copy, ThumbsUp, MessageCircle } from "lucide-react";
```

**Step 4: Render the counts**

In the right-side `<div className="flex items-center gap-3 shrink-0">`, add two count nodes before the `timeAgo` span:

```tsx
{approvalCount != null && approvalCount > 0 ? (
  <span className="inline-flex items-center gap-1 text-xs font-mono text-success/70">
    <ThumbsUp className="h-3 w-3" />
    {approvalCount}
  </span>
) : null}
{unresolvedDiscussionCount != null && unresolvedDiscussionCount > 0 ? (
  <span className="inline-flex items-center gap-1 text-xs font-mono text-warning/70">
    <MessageCircle className="h-3 w-3" />
    {unresolvedDiscussionCount}
  </span>
) : null}
```

The full right-side div should look like:

```tsx
<div className="flex items-center gap-3 shrink-0">
  {onMarkAsDone ? (
    <button
      type="button"
      className="inline-flex items-center justify-center h-6 w-6 rounded text-success/80 hover:text-success hover:bg-success/15 transition-colors cursor-pointer"
      aria-label="Mark as done"
      title="Mark as done"
      onClick={handleMarkAsDone}
    >
      <Check className="h-4 w-4" />
    </button>
  ) : null}
  {approvalCount != null && approvalCount > 0 ? (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-success/70">
      <ThumbsUp className="h-3 w-3" />
      {approvalCount}
    </span>
  ) : null}
  {unresolvedDiscussionCount != null && unresolvedDiscussionCount > 0 ? (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-warning/70">
      <MessageCircle className="h-3 w-3" />
      {unresolvedDiscussionCount}
    </span>
  ) : null}
  <span className="text-xs font-mono text-base-content/40 whitespace-nowrap">{timeAgo}</span>
  <Avatar src={author.avatarUrl} alt={author.name} size="sm" />
</div>
```

**Step 5: Verify TypeScript compiles**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add src/entities/inbox/ui/InboxItem.tsx
git commit -m "feat(ui): render approval count and unresolved discussion count on MR card"
```

---

### Task 6: Wire counts through `InboxItemList`

**Files:**
- Modify: `src/widgets/inbox-dashboard/ui/InboxItemList.tsx`

**Step 1: Pass counts to `<InboxItem>` when filter is "mrs"**

In `InboxItemList.tsx`, find the `<InboxItem>` render call (around line 148). Add two new props after `onMarkAsDone`:

```tsx
approvalCount={filter === "mrs" ? (mr?.approvalCount ?? undefined) : undefined}
unresolvedDiscussionCount={filter === "mrs" ? (mr?.unresolvedDiscussionCount ?? undefined) : undefined}
```

The full `<InboxItem>` call becomes:

```tsx
return (
  <InboxItem
    key={item.id}
    icons={icons}
    idLabel={idLabel}
    title={titleText}
    subtitle={subtitle}
    branchName={branchName}
    author={author}
    updatedAt={updatedAt}
    webUrl={webUrl}
    isSelected={isSelected}
    dataItemId={item.id}
    isHovered={isHovered}
    onMarkAsDone={canMarkAsDone ? handleTodoDone : undefined}
    approvalCount={filter === "mrs" ? mr?.approvalCount : undefined}
    unresolvedDiscussionCount={filter === "mrs" ? mr?.unresolvedDiscussionCount : undefined}
  />
);
```

**Step 2: Verify TypeScript compiles**

```bash
bun run typecheck
```

**Step 3: Run frontend tests**

```bash
bun test
```

Expected: all existing tests pass (no regressions — only added optional props).

**Step 4: Commit**

```bash
git add src/widgets/inbox-dashboard/ui/InboxItemList.tsx
git commit -m "feat(ui): pass approval and discussion counts to InboxItem in mrs tab"
```

---

### Task 7: Final verification

**Step 1: Run all Rust tests**

```bash
cd src-tauri && cargo test
```

Expected: all pass.

**Step 2: Run all frontend tests**

```bash
bun test
```

Expected: all pass.

**Step 3: Full typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 4: Build the app to verify end-to-end**

```bash
bun run build
```

Expected: completes without errors.
