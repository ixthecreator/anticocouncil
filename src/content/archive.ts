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
    description: "工作回顾、议事与共同计划。",
  },
  {
    id: "sample-term-two",
    title: "示例届次二",
    description: "交接、延续与新的思考。",
  },
] as const;
export const archiveRecords: readonly ArchiveRecord[] = [
  {
    slug: "sample-working-records",
    number: "01",
    termId: "sample-term-one",
    category: "工作回顾",
    title: "一届议会如何留下完整的工作记录",
    summary: "把一段时间里的讨论、决定与行动，整理成可以回望的共同记录。",
    isExample: true,
    sections: [
      {
        title: "从一份目录开始",
        paragraphs: [
          "一届议会的工作，常常散落在不同的会议、文件和对话里。把它们整理在一起，是为了让后来的人看清：这一段时间，我们关心过什么，又把哪些事情向前推进了一步。",
          "工作回顾可以从一份简洁的目录开始。按主题梳理讨论过的问题，按时间标明关键节点，再把相关的公开文章和文件放回各自的位置。目录不必包罗所有细节，但应让每条线索都可以继续查阅。",
        ],
      },
      {
        title: "记录过程，也记录未完成",
        paragraphs: [
          "一份完整的记录，既有已经形成的决定，也有仍待解决的问题。它可以说明一项工作起于怎样的提议，讨论带来了哪些变化，以及最后由谁接续推进。",
          "未完成的事项同样值得保留。写清已经尝试的方法、目前的进展和下一步需要回答的问题，比简单地写上“继续跟进”更能帮助下一届接手。",
        ],
      },
      {
        title: "让资料成为可以阅读的历史",
        paragraphs: [
          "公开的工作回顾需要给读者足够的背景。简要解释议题的缘起，让首次接触议会的人也能理解文章；为重要文件保留名称和出处，让熟悉这段工作的人可以找到细节。",
          "当这些记录按届次收拢在一起，档案便不只是文件的堆叠。它让一段共同工作的时间有了轮廓，也让新的讨论有了可以回看的起点。",
        ],
      },
    ],
  },
  {
    slug: "sample-from-proposal-to-resolution",
    number: "02",
    termId: "sample-term-one",
    category: "议事记录",
    title: "从一项提议，到一份可以回看的决议",
    summary: "记录结论，也留下一项提议为何提出、如何被讨论的来龙去脉。",
    isExample: true,
    sections: [
      {
        title: "提议从哪里来",
        paragraphs: [
          "一项提议通常始于一个具体的问题。保存它的缘起，意味着说明问题出现在哪里、影响了什么，以及提议希望带来怎样的改变。这样的背景能帮助后来查阅记录的人理解讨论为何发生。",
          "公开记录可以保留必要的议题背景与讨论主题，同时把内部工作材料留在成员工作台。两种记录面向不同的读者，需要分别整理。",
        ],
      },
      {
        title: "把讨论的变化写清楚",
        paragraphs: [
          "讨论会修正最初的想法。记录这些变化，可以围绕意见的主要内容展开：哪些条件被补充，哪些方案经过比较，哪些问题需要进一步确认。",
          "决议部分应当明确写出最终决定、适用范围和后续安排。已经确认的内容与仍在讨论的设想应分别呈现，避免读者把暂时的意见误认为最终结论。",
        ],
      },
      {
        title: "给后续行动留下线索",
        paragraphs: [
          "一份可回看的决议，能够帮助人们重新进入当时的工作语境。后续有了新的进展，可以通过独立的补充记录与原文关联，让读者沿着同一条线索了解事情如何继续。",
        ],
      },
    ],
  },
  {
    slug: "sample-passing-the-records",
    number: "03",
    termId: "sample-term-two",
    category: "文章与思考",
    title: "交接之后，记录仍在继续",
    summary: "让后来的人读懂已经发生的事，也为尚未完成的工作保留线索。",
    isExample: true,
    sections: [
      {
        title: "为下一位阅读者写作",
        paragraphs: [
          "整理资料时，我们往往记得许多没有写下来的背景。到了交接的时候，这些看似自然的共识，可能恰好是下一位阅读者最需要了解的部分。",
          "不妨把记录交给一位不熟悉这项工作的人阅读：他能否知道事情从何开始，现在停在哪里，以及还需要找到哪些材料？那些需要口头补充的解释，正是可以继续写进记录的内容。",
        ],
      },
      {
        title: "保留一份可以找到的目录",
        paragraphs: [
          "交接材料可以按持续中的工作、已经完成的事项和可供参考的经验分别整理。每一部分都留出简短说明，再附上对应资料的名称与位置。",
          "已经公开的文章和文件，可以在所属届次下长期保留。后来的读者仍然能够按原来的题目查阅，而新的工作则在新的届次中继续积累。",
        ],
      },
      {
        title: "留存，也意味着延续",
        paragraphs: [
          "记录不必把过去包装成一个没有分歧的故事。保留问题、选择与修订，才能让下一届在理解已有经验的基础上，继续做出自己的判断。",
          "一份交接完成之后，记录的工作并没有结束。每一次补充背景、修正出处和整理目录，都是在让共同的记忆更清晰一点。",
        ],
      },
    ],
  },
];

export const hasArchiveExamples = archiveRecords.some(
  (record) => record.isExample,
);
