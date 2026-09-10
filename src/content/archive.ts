/** Public editorial content only. Never import workspace stores or Firebase data here. */
export type ArchiveSection = { title: string; paragraphs: readonly string[] };
export type ArchiveRecord = {
  slug: string;
  number: string;
  termId: string;
  category: string;
  title: string;
  summary: string;
  sections: readonly ArchiveSection[];
} & (
  | { isExample: true }
  | { isExample: false; publishedOn: string; byline: string }
);
export const archiveTerms = [
  {
    id: "sample-term-one",
    title: "示例届次一",
    description: "会议纪要、工作进度与待办事项。",
  },
  {
    id: "sample-term-two",
    title: "示例届次二",
    description: "交接清单、资料目录与工作说明。",
  },
] as const;
export const archiveRecords: readonly ArchiveRecord[] = [
  {
    slug: "sample-working-records",
    number: "01",
    termId: "sample-term-one",
    category: "工作回顾",
    title: "会议与工作记录的整理",
    summary: "按会议日期和工作事项整理资料，写清决定、进度和待办。",
    isExample: true,
    sections: [
      {
        title: "列出会议与事项",
        paragraphs: [
          "工作目录可列出会议日期、议题名称和纪要位置。跨多次会议讨论的事项，集中列出相关记录，方便查阅前后的决定。",
          "每项工作附一段简要说明，写明提出时间、负责人员和当前进度。有关的文章、决议和其他文件，使用完整名称并附上链接。",
        ],
      },
      {
        title: "写清进展和待办",
        paragraphs: [
          "已完成的事项注明完成日期和结果；进行中的事项写明已做的工作、尚未解决的问题，以及下一步安排。",
          "待办事项应有明确的负责人和预计完成时间。暂时无法确定的，注明原因和需要谁确认，避免只留下“继续跟进”四个字。",
        ],
      },
      {
        title: "补齐查阅信息",
        paragraphs: [
          "文章中首次出现的简称应写出全称。引用决议或其他文件时，注明文件名称和日期，让读者能够找到原文。",
          "整理完成后，检查目录中的链接是否可用、文件名称是否一致。同名文件有多个版本时，标明日期和版本，避免误用旧稿。",
        ],
      },
    ],
  },
  {
    slug: "sample-from-proposal-to-resolution",
    number: "02",
    termId: "sample-term-one",
    category: "议事记录",
    title: "提案、讨论与决议的记录",
    summary: "写明提案背景、主要意见、最终决定和执行安排。",
    isExample: true,
    sections: [
      {
        title: "说明提案背景",
        paragraphs: [
          "议题开头写明需要解决的问题、涉及的人员或工作，以及提出的方案。引用已有规定或此前的决定时，注明出处。",
          "涉及经费、场地或人员安排的提案，应列出已知条件和仍待确认的信息。资料不足的地方直接注明，便于后续补充。",
        ],
      },
      {
        title: "记录主要意见和决定",
        paragraphs: [
          "按问题归纳讨论中的主要意见，写明方案作了哪些修改、修改的理由，以及仍有分歧的部分。",
          "决议单独列出最终决定、适用范围和执行时间。尚未形成决定的内容标为待议；经过表决的事项，注明表决日期和公开结果。",
        ],
      },
      {
        title: "列出执行安排",
        paragraphs: [
          "每项执行安排写明负责人、截止日期和需提交的结果。后续进展另附日期记录，并注明对应的决议；调整原决定时，保留调整依据和日期。",
        ],
      },
    ],
  },
  {
    slug: "sample-passing-the-records",
    number: "03",
    termId: "sample-term-two",
    category: "交接资料",
    title: "交接清单与资料说明",
    summary: "列出未结事项、负责人员和资料位置，补上接手工作所需的背景。",
    isExample: true,
    sections: [
      {
        title: "补充必要背景",
        paragraphs: [
          "交接说明应写明工作的起因、已作出的决定和当前进度。涉及口头约定的，补充约定内容、时间和确认人员。",
          "请接手人员核对材料。查阅时需要补问的背景、找不到的文件和不清楚的分工，逐项补充到交接说明中。",
        ],
      },
      {
        title: "整理交接目录",
        paragraphs: [
          "交接目录分为未结事项、已完成工作和参考资料。未结事项注明下一步安排、负责人和时间要求，其余材料注明用途和存放位置。",
          "已公开的文章保留原题目和所属届次。跨届继续办理的事项，在新的工作记录中附上原有材料的链接。",
        ],
      },
      {
        title: "标注后续修订",
        paragraphs: [
          "交接后发现记录有误，注明更正内容和日期。对尚未核实的说法，保留核实状态，待确认后补充。",
          "后续工作采用了不同方案的，另行记录决定和理由，并关联原事项，方便查清调整经过。",
        ],
      },
    ],
  },
];

export const hasArchiveExamples = archiveRecords.some(
  (record) => record.isExample,
);
