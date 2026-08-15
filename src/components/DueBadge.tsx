import { dueDisplay } from "../lib/time";
import type { Task } from "../lib/types";

export default function DueBadge({ due }: { due: Task["due"] }) {
  if (due == null) return <span>—</span>;
  const { text, tone } = dueDisplay(due);
  return <span className={tone ? `due-${tone}` : ""}>{text}</span>;
}
