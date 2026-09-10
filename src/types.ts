/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'agenda' | 'voting' | 'passed' | 'rejected' | 'authorization' | 'execution' | 'completed';

export interface Member {
  id: string;
  name: string;
  role: string;
  avatarSymbol: string; // classical symbol/initials
}

export interface Issue {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: Status;
  description: string;
  discussion: string; // Resolution/discussion notes
  signature: string;  // Member ID who is responsible / signed off
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  archivedAt?: string;
  serialNumber?: string; // e.g. "20260720-01"
  meetingId: string | null; // Associated meeting
  // Voting data
  votes?: {
    approve: number;
    reject: number;
    abstain: number;
  };
  voteRule?: 'simple' | 'absolute'; // 简单多数 or 绝对多数
  voteMode?: 'manual' | 'members' | 'private' | 'legacy';
  voteRoundId?: string;
  voteClosedAt?: string;
  ballots?: Record<string, 'approve' | 'reject' | 'abstain'>;
  dueDate?: string;
}

export interface Meeting {
  id: string;
  title: string;      // e.g. "2026年第30周例会"
  week: string;       // e.g. "2026-W30"
  date: string;       // e.g. "2026-07-20"
  summary: string;    // 汇报摘要
  regularReport?: string; // 常规报告
  createdAt: string;
  issueIds: string[]; // Bounded issues
}

export interface ActivityEvent {
  id: string;
  time: string;
  organizer: string;
  name: string;
  participants: string;
  location?: string;
  description?: string;
  status?: 'planned' | 'completed' | 'cancelled';
}

export interface Attendance {
  id: string;
  meetingId: string;
  memberId: string;
  memberName: string;
  checkedInAt: string;
  reportStatus: 'pending' | 'reported' | 'exempt';
  reportNote: string;
  reportedAt?: string;
}

export interface EditorialItem {
  id: string;
  title: string;
  department: '微信编辑部' | 'QQ编辑部';
  author: string;
  editor: string;
  designer: string;
  dueDate: string;
  status: '选题' | '撰稿' | '编辑' | '排版' | '已发布';
  notes: string;
}

export interface LibraryAsset {
  id: string;
  title: string;
  kind: '作者名片' | '美工素材' | '往期成果';
  author: string;
  tags: string;
  url: string;
  fileName: string;
  fileData: string;
  notes: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  title: string;
  location: string;
  quantity: number;
  keeper: string;
  notes: string;
}

export interface WorkspaceData {
  meetings: Meeting[];
  issues: Issue[];
  members: Member[];
  activities: ActivityEvent[];
  attendance: Attendance[];
  editorial: EditorialItem[];
  assets: LibraryAsset[];
  inventory: InventoryItem[];
}

export const INITIAL_MEMBERS: Member[] = [];

export const DEFAULT_DEPARTMENTS: string[] = [
  '微信编辑部',
  'qq编辑部',
  '综合事务部',
  '后勤美工部',
  '外联部',
  '学术新闻追踪小组',
  '拉美小组',
  '其他'
];
