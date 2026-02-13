const SECOND_MS = 1000;
const MINUTE_MS = SECOND_MS * 60;
const HOUR_MS = MINUTE_MS * 60;
const DAY_MS = HOUR_MS * 24;
const WEEK_MS = DAY_MS * 7;
const MONTH_MS = DAY_MS * 30;
const YEAR_MS = DAY_MS * 365;
const NOW_THRESHOLD_MS = SECOND_MS * 5;

export const formatShortRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }
  const diffMs = Math.max(0, Date.now() - date.getTime());
  if (diffMs < NOW_THRESHOLD_MS) {
    return "now";
  }
  if (diffMs < MINUTE_MS) {
    return `${Math.max(1, Math.floor(diffMs / SECOND_MS))}s`;
  }
  if (diffMs < HOUR_MS) {
    return `${Math.max(1, Math.floor(diffMs / MINUTE_MS))}m`;
  }
  if (diffMs < DAY_MS) {
    return `${Math.max(1, Math.floor(diffMs / HOUR_MS))}h`;
  }
  if (diffMs < WEEK_MS) {
    return `${Math.max(1, Math.floor(diffMs / DAY_MS))}d`;
  }
  if (diffMs < MONTH_MS) {
    return `${Math.max(1, Math.floor(diffMs / WEEK_MS))}w`;
  }
  if (diffMs < YEAR_MS) {
    return `${Math.max(1, Math.floor(diffMs / MONTH_MS))}mo`;
  }
  return `${Math.max(1, Math.floor(diffMs / YEAR_MS))}y`;
};
