/**
 * Workspace pages in navigation order. The "会议协作" group follows the life of
 * an issue (overview → meeting → decision → follow-up → supervision → record)
 * and forms the primary navigation; the "日常工作" group sits in its own menu.
 * `search` names what the page search covers (it completes the field's
 * accessible name, "搜索…"); `searchHint` is the short placeholder that
 * fits the field on a 320px screen.
 */
export const workspaceNavigation = [
  {
    id: "overview",
    title: "议会概览",
    description: "查看本周例会、待议事项和执行进度。",
    group: "会议协作",
    search: "待议事项与待办",
    searchHint: "议题或待办",
  },
  {
    id: "session",
    title: "例会与议程",
    description: "查看会议议程，安排每周汇报，记录讨论与表决。",
    group: "会议协作",
    search: "本次会议的议题",
    searchHint: "本次议题",
  },
  {
    id: "proposals",
    title: "议题与表决",
    description: "了解议题背景，发表意见，查阅表决结果。",
    group: "会议协作",
    search: "全部议题",
    searchHint: "议题名称",
  },
  {
    id: "post",
    title: "会后执行",
    description: "跟进本次会议的授权与执行，把决议落实为行动。",
    group: "会议协作",
    search: "本次会议的待办",
    searchHint: "本次待办",
  },
  {
    id: "supervision",
    title: "执行督办",
    description: "记录每项决定的负责人、期限与进展。",
    group: "会议协作",
    search: "执行事项",
    searchHint: "事项名称",
  },
  {
    id: "archive",
    title: "纪要档案",
    description: "查阅往期会议记录、决议与执行分工。",
    group: "会议协作",
    search: "会议名称、日期、报告",
    searchHint: "会议或日期",
  },
  {
    id: "activity",
    title: "月度沙龙",
    description: "安排沙龙时间，记录话题与参与者。",
    group: "日常工作",
    search: "沙龙、组织者、地点",
    searchHint: "沙龙或地点",
  },
  {
    id: "editorial",
    title: "编辑部",
    description: "安排从选题到发布的工作，协调作者、编辑与美工。",
    group: "日常工作",
    search: "编辑安排",
    searchHint: "选题或作者",
  },
  {
    id: "cards",
    title: "名片制作",
    description: "制作个人名片，下载高清图片，或保存到团队资料库。",
    group: "日常工作",
    search: "",
    searchHint: "",
  },
  {
    id: "assets",
    title: "资料库",
    description: "查找作者资料、设计素材与往期成果。",
    group: "日常工作",
    search: "资料、作者、标签",
    searchHint: "资料或作者",
  },
  {
    id: "inventory",
    title: "文创库存",
    description: "记录物品、数量与存放位置。",
    group: "日常工作",
    search: "物品、存放位置、保管人",
    searchHint: "物品或位置",
  },
] as const;

export type WorkspacePage = (typeof workspaceNavigation)[number]["id"];
export function workspacePageFromHash(hash: string): WorkspacePage {
  const page = hash.replace(/^#/, "");
  return workspaceNavigation.find((item) => item.id === page)?.id || "overview";
}
