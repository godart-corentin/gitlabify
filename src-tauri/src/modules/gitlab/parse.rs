use reqwest::Url;

const MERGE_REQUEST_PATH_SEGMENT: &str = "/merge_requests/";
const MERGE_REQUEST_PATH_SEPARATOR: &str = "/-/merge_requests/";

pub(crate) enum ProjectRef {
    Id(u64),
    Path(String),
}

pub(crate) fn is_comment_or_mention_action(action_name: &str) -> bool {
    action_name.eq_ignore_ascii_case("commented")
        || action_name.eq_ignore_ascii_case("mentioned")
        || action_name.eq_ignore_ascii_case("directly_addressed")
}

pub(crate) fn extract_merge_request_iid(target_url: &str) -> Option<u64> {
    let start_index = target_url.find(MERGE_REQUEST_PATH_SEGMENT)?;
    let start = start_index + MERGE_REQUEST_PATH_SEGMENT.len();
    let rest = target_url.get(start..)?;
    let iid_str = rest.split(['/', '?', '#']).next()?;
    iid_str.parse::<u64>().ok()
}

pub(crate) fn extract_project_path(target_url: &str) -> Option<String> {
    let url = Url::parse(target_url).ok()?;
    let path = url.path();
    let split_index = path.find(MERGE_REQUEST_PATH_SEPARATOR)?;
    let project_path = path.get(1..split_index)?;
    if project_path.is_empty() {
        return None;
    }
    Some(project_path.to_string())
}

pub(crate) fn resolve_project_ref(project_id: Option<u64>, target_url: &str) -> Option<ProjectRef> {
    if let Some(id) = project_id {
        return Some(ProjectRef::Id(id));
    }

    let path = extract_project_path(target_url)?;
    Some(ProjectRef::Path(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_merge_request_iid_from_url() {
        let iid = extract_merge_request_iid(
            "https://gitlab.com/group/project/-/merge_requests/42#note_1",
        );
        assert_eq!(iid, Some(42));
    }

    #[test]
    fn extracts_project_path_from_url() {
        let path =
            extract_project_path("https://gitlab.com/group/subgroup/project/-/merge_requests/42");
        assert_eq!(path.as_deref(), Some("group/subgroup/project"));
    }
}
