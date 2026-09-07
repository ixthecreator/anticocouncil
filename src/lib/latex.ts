import type { WorkspaceData } from "../types";
import { meetingBrief } from "./workspace";
export const escapeLatex = (value: string) =>
  value.replace(
    /[\\{}$&#%_^~]/g,
    (char) =>
      ({
        "\\": "\\textbackslash{}",
        "{": "\\{",
        "}": "\\}",
        $: "\\$",
        "&": "\\&",
        "#": "\\#",
        "%": "\\%",
        _: "\\_",
        "^": "\\textasciicircum{}",
        "~": "\\textasciitilde{}",
      })[char]!,
  );
export function latexDocument(data: WorkspaceData, ids: string[]) {
  const sections = data.meetings
    .filter((meeting) => ids.includes(meeting.id))
    .map(
      (meeting) =>
        `\\section*{${escapeLatex(meeting.title)}}\n${meetingBrief(
          data,
          meeting.id,
        )
          .split("\n")
          .map((line) => (line ? escapeLatex(line) + "\\par" : "\\medskip"))
          .join("\n")}`,
    );
  return `% 使用 XeLaTeX 编译\n\\documentclass[UTF8,a4paper]{ctexart}\n\\usepackage[margin=22mm]{geometry}\n\\begin{document}\n${sections.join("\n\\newpage\n")}\n\\end{document}`;
}
