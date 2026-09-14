export const workspaceNavigation = [
  {
    id: "overview",
    title: "议会概览",
    description: "参与讨论，作出决定，跟进每一项承诺。",
    kicker: "COUNCIL BUSINESS",
    group: "会议协作",
    search: "搜索待议事项与待办…",
  },
  {
    id: "session",
    title: "例会与议程",
    description: "查看会议、安排每周汇报，记录讨论与表决。",
    kicker: "MEETINGS & AGENDAS",
    group: "会议协作",
    search: "搜索本次会议的议题…",
  },
  {
    id: "proposals",
    title: "议题与表决",
    description: "了解议题背景，表达意见，查阅共同作出的决定。",
    kicker: "PROPOSALS & DECISIONS",
    group: "会议协作",
    search: "搜索全部议题…",
  },
  {
    id: "supervision",
    title: "执行督办",
    description: "从会议决定到具体行动，持续记录责任与进展。",
    kicker: "FOLLOW-UP & ACCOUNTABILITY",
    group: "会议协作",
    search: "搜索执行事项…",
  },
  {
    id: "archive",
    title: "纪要档案",
    description: "回顾会议记录、决议与执行分工。",
    kicker: "RECORDS & PUBLICATIONS",
    group: "会议协作",
    search: "搜索会议名称、日期、报告…",
  },
  {
    id: "post",
    title: "会后执行",
    description: "跟进本次会议的授权与执行，把决议变成实际进展。",
    kicker: "MEETING FOLLOW-UP",
    group: "会议协作",
    search: "搜索本次会议的待办…",
  },
  {
    id: "activity",
    title: "月度沙龙",
    description: "规划相聚的时间，记录话题与参与者。",
    kicker: "EVENTS & COMMUNITY",
    group: "日常工作",
    search: "搜索沙龙、组织者、地点…",
  },
  {
    id: "editorial",
    title: "编辑部",
    description: "从选题到发布，协同作者、编辑与美工。",
    kicker: "EDITORIAL CALENDAR",
    group: "日常工作",
    search: "搜索编辑安排…",
  },
  {
    id: "assets",
    title: "资料库",
    description: "查找作者资料、设计素材与往期成果。",
    kicker: "SHARED RESOURCES",
    group: "日常工作",
    search: "搜索资料、作者、标签…",
  },
  {
    id: "inventory",
    title: "文创库存",
    description: "记录物品、数量与存放位置。",
    kicker: "INVENTORY",
    group: "日常工作",
    search: "搜索物品、存放位置、保管人…",
  },
] as const;

export type WorkspacePage = (typeof workspaceNavigation)[number]["id"];
export type WorkspaceTheme =
  "parliament" | "classic" | "prussian" | "burgundy" | "latenight";
export function workspacePageFromHash(hash: string): WorkspacePage {
  const page = hash.replace(/^#/, "");
  return workspaceNavigation.find((item) => item.id === page)?.id || "overview";
}
export function workspaceTheme(value: string | null): WorkspaceTheme {
  return (
    (
      ["parliament", "classic", "prussian", "burgundy", "latenight"] as const
    ).find((theme) => theme === value) || "parliament"
  );
}
