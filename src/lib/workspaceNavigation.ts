/**
 * Workspace pages in navigation order. The "会议协作" group follows the life of
 * an issue (overview → meeting → decision → follow-up → supervision → record)
 * and forms the primary navigation; the "日常工作" group sits in its own menu.
 */
export const workspaceNavigation = [
  {
    id: "overview",
    title: "议会概览",
    description: "查看本周例会、待议事项和执行进度。",
    group: "会议协作",
    search: "搜索待议事项与待办…",
  },
  {
    id: "session",
    title: "例会与议程",
    description: "查看会议议程，安排每周汇报，记录讨论与表决。",
    group: "会议协作",
    search: "搜索本次会议的议题…",
  },
  {
    id: "proposals",
    title: "议题与表决",
    description: "了解议题背景，发表意见，查阅表决结果。",
    group: "会议协作",
    search: "搜索全部议题…",
  },
  {
    id: "post",
    title: "会后执行",
    description: "跟进本次会议的授权与执行，把决议落实为行动。",
    group: "会议协作",
    search: "搜索本次会议的待办…",
  },
  {
    id: "supervision",
    title: "执行督办",
    description: "记录每项决定的负责人、期限与进展。",
    group: "会议协作",
    search: "搜索执行事项…",
  },
  {
    id: "archive",
    title: "纪要档案",
    description: "查阅往期会议记录、决议与执行分工。",
    group: "会议协作",
    search: "搜索会议名称、日期、报告…",
  },
  {
    id: "activity",
    title: "月度沙龙",
    description: "安排沙龙时间，记录话题与参与者。",
    group: "日常工作",
    search: "搜索沙龙、组织者、地点…",
  },
  {
    id: "editorial",
    title: "编辑部",
    description: "安排从选题到发布的工作，协调作者、编辑与美工。",
    group: "日常工作",
    search: "搜索编辑安排…",
  },
  {
    id: "cards",
    title: "名片制作",
    description: "制作个人名片，下载高清图片，或保存到团队资料库。",
    group: "日常工作",
    search: "",
  },
  {
    id: "assets",
    title: "资料库",
    description: "查找作者资料、设计素材与往期成果。",
    group: "日常工作",
    search: "搜索资料、作者、标签…",
  },
  {
    id: "inventory",
    title: "文创库存",
    description: "记录物品、数量与存放位置。",
    group: "日常工作",
    search: "搜索物品、存放位置、保管人…",
  },
] as const;

export type WorkspacePage = (typeof workspaceNavigation)[number]["id"];
export function workspacePageFromHash(hash: string): WorkspacePage {
  const page = hash.replace(/^#/, "");
  return workspaceNavigation.find((item) => item.id === page)?.id || "overview";
}
