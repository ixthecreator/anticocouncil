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

