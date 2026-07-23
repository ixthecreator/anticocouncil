/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Issue, Meeting, Member, Status, Priority, DEFAULT_DEPARTMENTS, ActivityEvent } from './types';
import { MeetingManager } from './components/MeetingManager';
import { IssueDetailModal } from './components/IssueDetailModal';
import { SessionView } from './components/SessionView';
import { PostMeetingView } from './components/PostMeetingView';
import { ArchiveView } from './components/ArchiveView';
import { SupervisionView } from './components/SupervisionView';
import { ActivityView } from './components/ActivityView';
import { 
  Columns, 
  List, 
  BookOpen, 
  Plus, 
  Calendar, 
  Clock,
  ArrowUpDown,
  FileText,
  Download,
  AlertCircle,
  Gavel,
  CheckSquare,
  FolderOpen,
  Activity,
  Settings,
  Search,
  Upload,
  Database
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { db, saveDoc, removeDoc, subscribeToCollection } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';



// Import GitHub Sync helpers


export default function App() {
  // --- STATE ---
  const [storageMode, setStorageMode] = useState<'local' | 'firebase'>(() => {
    return (localStorage.getItem('storage_mode') as any) || 'firebase';
  });

  useEffect(() => {
    localStorage.setItem('storage_mode', storageMode);
  }, [storageMode]);

  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);

  // Firestore Subscriptions
  useEffect(() => {
    const unsubIssues = subscribeToCollection('issues', (data) => setIssues(data as Issue[]));
    const unsubMeetings = subscribeToCollection('meetings', (data) => {
      const sorted = (data as Meeting[]).sort((a, b) => a.date.localeCompare(b.date));
      setMeetings(sorted);
      if (sorted.length > 0) {
        setCurrentMeetingId(prev => prev ? (sorted.find(m => m.id === prev) ? prev : sorted[sorted.length - 1].id) : sorted[sorted.length - 1].id);
      } else {
        setCurrentMeetingId(null);
      }
    });
    const unsubMembers = subscribeToCollection('members', (data) => setMembers(data as Member[]));
    const unsubActivities = subscribeToCollection('activities', (data) => {
      const sorted = (data as ActivityEvent[]).sort((a, b) => a.time.localeCompare(b.time));
      setActivities(sorted);
    });

    return () => {
      unsubIssues();
      unsubMeetings();
      unsubMembers();
      unsubActivities();
    };
  }, []);

  // Filtering & Sorting State
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [selectedSignatureFilter, setSelectedSignatureFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'session' | 'post' | 'archive' | 'supervision' | 'activity'>('session');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban'); 
  const [listSortKey, setListSortKey] = useState<'priority' | 'category' | 'status'>('priority');
  const [listSortOrder, setListSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');

  // Theme State
  const [theme, setTheme] = useState<'classic' | 'prussian' | 'burgundy' | 'latenight'>(() => {
    return (localStorage.getItem('app_theme') as any) || 'prussian';
  });
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Modal State
  const [activeIssueForDetail, setActiveIssueForDetail] = useState<Issue | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  const [selectedMeetingIdsForExport, setSelectedMeetingIdsForExport] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');

  const [isCompiling, setIsCompiling] = useState(false);
  const handleStartAddIssue = () => {
    setActiveIssueForDetail({
      id: crypto.randomUUID(),
      title: '',
      category: '其他',
      priority: 'medium',
      status: 'agenda',
      description: '',
      discussion: '',
      signature: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      meetingId: currentMeetingId
    } as any);
    setIsAddingNew(true);
  };


  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Populate default export selections when meetings are synchronized
  useEffect(() => {
    if (meetings.length > 0 && selectedMeetingIdsForExport.length === 0) {
      setSelectedMeetingIdsForExport(meetings.map(m => m.id));
    }
  }, [meetings]);

  const updateLocal = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // --- FIREBASE CRUD HANDLERS ---
  const handleSaveIssue = async (updated: Issue) => {
    if (storageMode === 'firebase') {
      try { await saveDoc('issues', updated); } catch (err) { console.error(err); }
    } else {
      const newIssues = [...issues];
      const idx = newIssues.findIndex(i => i.id === updated.id);
      if (idx >= 0) newIssues[idx] = updated; else newIssues.push(updated);
      setIssues(newIssues);
      updateLocal('local_issues', newIssues);
    }
  };
  const handleDeleteIssue = async (id: string) => {
    if (storageMode === 'firebase') {
      try { await removeDoc('issues', id); } catch (err) { console.error(err); }
    } else {
      const newIssues = issues.filter(i => i.id !== id);
      setIssues(newIssues);
      updateLocal('local_issues', newIssues);
    }
  };
  const handleAddMeeting = async (newMeeting: Meeting) => {
    if (storageMode === 'firebase') {
      try { await saveDoc('meetings', newMeeting); setCurrentMeetingId(newMeeting.id); } catch (err) { console.error(err); }
    } else {
      const newMeetings = [...meetings, newMeeting].sort((a, b) => a.date.localeCompare(b.date));
      setMeetings(newMeetings);
      setCurrentMeetingId(newMeeting.id);
      updateLocal('local_meetings', newMeetings);
    }
  };
  const handleUpdateMeetingSummary = async (id: string, summary: string) => {
    const m = meetings.find(x => x.id === id);
    if (m) {
      if (storageMode === 'firebase') {
        await saveDoc('meetings', { ...m, summary });
      } else {
        const newMeetings = meetings.map(x => x.id === id ? { ...x, summary } : x);
        setMeetings(newMeetings);
        updateLocal('local_meetings', newMeetings);
      }
    }
  };
  const handleUpdateMeetingRegularReport = async (id: string, regularReport: string) => {
    const m = meetings.find(x => x.id === id);
    if (m) {
      if (storageMode === 'firebase') {
        await saveDoc('meetings', { ...m, regularReport });
      } else {
        const newMeetings = meetings.map(x => x.id === id ? { ...x, regularReport } : x);
        setMeetings(newMeetings);
        updateLocal('local_meetings', newMeetings);
      }
    }
  };
  const handleDeleteMeeting = async (id: string) => {
    if (storageMode === 'firebase') {
      try { await removeDoc('meetings', id); if (currentMeetingId === id) setCurrentMeetingId(null); } catch (err) { console.error(err); }
    } else {
      const newMeetings = meetings.filter(x => x.id !== id);
      setMeetings(newMeetings);
      if (currentMeetingId === id) setCurrentMeetingId(null);
      updateLocal('local_meetings', newMeetings);
    }
  };
  const handleAddMember = async (m: Member) => {
    if (storageMode === 'firebase') {
      try { await saveDoc('members', m); } catch (err) { console.error(err); }
    } else {
      const newMembers = [...members];
      const idx = newMembers.findIndex(x => x.id === m.id);
      if (idx >= 0) newMembers[idx] = m; else newMembers.push(m);
      setMembers(newMembers);
      updateLocal('local_members', newMembers);
    }
  };
  const handleDeleteMember = async (id: string) => {
    if (storageMode === 'firebase') {
      try { await removeDoc('members', id); } catch (err) { console.error(err); }
    } else {
      const newMembers = members.filter(x => x.id !== id);
      setMembers(newMembers);
      updateLocal('local_members', newMembers);
    }
  };
  const handleAddActivity = async (activity: ActivityEvent) => {
    if (storageMode === 'firebase') {
      try { await saveDoc('activities', activity); } catch (err) { console.error(err); }
    } else {
      const newActivities = [...activities, activity].sort((a, b) => a.time.localeCompare(b.time));
      setActivities(newActivities);
      updateLocal('local_activities', newActivities);
    }
  };
  const handleDeleteActivity = async (id: string) => {
    if (storageMode === 'firebase') {
      try { await removeDoc('activities', id); } catch (err) { console.error(err); }
    } else {
      const newActivities = activities.filter(x => x.id !== id);
      setActivities(newActivities);
      updateLocal('local_activities', newActivities);
    }
  };

  // --- JSON IMPORT/EXPORT ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const data = { meetings, issues, members, activities };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anticocouncil_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        const newMeetings = parsed.meetings || [];
        const newIssues = parsed.issues || [];
        const newMembers = parsed.members || [];
        const newActivities = parsed.activities || [];

        if (storageMode === 'firebase') {
          for (const m of newMeetings) await saveDoc('meetings', m);
          for (const i of newIssues) await saveDoc('issues', i);
          for (const mem of newMembers) await saveDoc('members', mem);
          for (const act of newActivities) await saveDoc('activities', act);
          alert('JSON 数据云端写入成功！');
        } else {
          setMeetings(newMeetings);
          setIssues(newIssues);
          setMembers(newMembers);
          setActivities(newActivities);
          localStorage.setItem('local_meetings', JSON.stringify(newMeetings));
          localStorage.setItem('local_issues', JSON.stringify(newIssues));
          localStorage.setItem('local_members', JSON.stringify(newMembers));
          localStorage.setItem('local_activities', JSON.stringify(newActivities));
          alert('JSON 数据本地导入成功！');
        }
      } catch (err) {
        console.error('Error importing JSON:', err);
        alert('读取 JSON 文件失败，请确认文件格式。');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // --- EXPORT AND COMPILATION SYSTEMS (PDF & LaTeX) ---

  const handleToggleMeetingExportSelection = (id: string) => {
    setSelectedMeetingIdsForExport(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  // 1. One-click LaTeX Download
  const handleExportLatex = () => {
    if (selectedMeetingIdsForExport.length === 0) {
      alert('请至少选择一个周期例会进行导出。');
      return;
    }

    const exportedMeetings = meetings.filter(m => selectedMeetingIdsForExport.includes(m.id));
    
    let doc = `% ==========================================================\n`;
    doc += `% 议事会议纪要与决议公报 (Assembly Compilation & Resolution Bulletin)\n`;
    doc += `% 编译生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    doc += `% ==========================================================\n\n`;
    doc += `\\documentclass[11pt, a4paper]{article}\n`;
    doc += `\\usepackage[utf8]{inputenc}\n`;
    doc += `\\usepackage{geometry}\n`;
    doc += `\\geometry{a4paper, margin=1in}\n`;
    doc += `\\usepackage{booktabs}\n`;
    doc += `\\usepackage{hyperref}\n`;
    doc += `\\usepackage{enumitem}\n\n`;
    
    doc += `\\title{\\textbf{议事会议纪要与决议公报}}\n`;
    doc += `\\author{议事系统编译引擎}\n`;
    doc += `\\date{编译时刻: \\today}\n\n`;
    
    doc += `\\begin{document}\n`;
    doc += `\\maketitle\n\n`;
    
    doc += `\\section*{导出概述}\n`;
    doc += `本决议公报共导出了以下 ${exportedMeetings.length} 期例会周期的核心常规报告与各子类议题决议清单：\\\\\n`;
    doc += `请全体与会成员、承办人秉持绝对责任制，严格根据决议进行销号。\\\\\n\n`;
    
    exportedMeetings.forEach((m, index) => {
      const mIssues = issues.filter(i => i.meetingId === m.id);
      
      doc += `\\subsection*{${index + 1}. ${m.title} (${m.week})}\n`;
      doc += `\\textbf{召开日期:} ${m.date}\\\\\n`;
      doc += `\\textbf{常规报告:}\\\\\n`;
      doc += `${m.regularReport || '暂无常规报告。'}\\\\\n\n`;
      
      doc += `\\noindent\\textbf{绑定的子类议题决议清单:}\n`;
      if (mIssues.length === 0) {
        doc += `本期例会周期未关联任何子类议题。\\\\\n`;
      } else {
        doc += `\\begin{itemize}\n`;
        mIssues.forEach(i => {
          const statusText = i.status === 'completed' ? '归档完成' : i.status === 'execution' ? '执行' : i.status === 'authorization' ? '授权' : '议程';
          const priorityText = i.priority === 'urgent' ? '紧急' : i.priority === 'high' ? '高' : i.priority === 'medium' ? '中' : '低';
          doc += `  \\item \\textbf{《${i.title}》} [${i.category} | 优先级: ${priorityText} | 状态: ${statusText}] \\\\\n`;
          if (i.description) {
            doc += `    \\textit{事项描述:} ${i.description}\\\\\n`;
          }
          if (i.discussion) {
            doc += `    \\textit{会商结论:} ${i.discussion}\\\\\n`;
          }
          doc += `    \\textit{执行落款:} ${i.signature || '待指派'}\n`;
        });
        doc += `\\end{itemize}\n`;
      }
      doc += `\\rule{\\textwidth}{0.5pt}\n\n`;
    });
    
    doc += `\\section*{全体成员鉴章}\n`;
    doc += `兹证明以上公报中记录之各项决议符合全体参会成员代表之共识。\\\\\n`;
    doc += `\\begin{center}\n`;
    doc += `\\begin{tabular}{ccc}\n`;
    doc += `  \\rule{4cm}{0.4pt} & \\rule{4cm}{0.4pt} & \\rule{4cm}{0.4pt} \\\\\n`;
    doc += `  主事人签字 & 监察人签字 & 经办人签字 \\\\\n`;
    doc += `\\end{tabular}\n`;
    doc += `\\end{center}\n\n`;
    
    doc += `\\end{document}\n`;

    const blob = new Blob([doc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assembly_latex_doc_${Date.now()}.tex`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. High-Fidelity PDF Exporter using jsPDF and html2canvas
  const handleExportPDF = async () => {
    if (selectedMeetingIdsForExport.length === 0) {
      alert('请至少选择一个周期例会进行导出。');
      return;
    }

    setIsCompiling(true);
    // Tiny delay to ensure DOM is fully computed and painted
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const element = document.getElementById('pdf-compile-preview');
      if (!element) {
        throw new Error('未找到编译预览区域');
      }

      // Render canvas with maximum crispness and direct element width
      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800, // Forces the rendering canvas to be exactly 800px wide
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 standard width in mm
      const pageHeight = 295; // A4 standard height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Handles paging cleanly for larger multi-meeting compilations
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`assembly_report_${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF导出失败:', err);
      alert('PDF编译导出中遇到意外错误。');
    } finally {
      setIsCompiling(false);
    }
  };

  // --- SORTING AND FILTERING FOR LIST VIEW ---
  const handleSort = (key: 'priority' | 'category' | 'status') => {
    if (listSortKey === key) {
      setListSortOrder(listSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setListSortKey(key);
      setListSortOrder('asc');
    }
  };

  const priorityWeightMap = { urgent: 4, high: 3, medium: 2, low: 1 };

  const getSortedAndFilteredList = () => {
    // 1. Base filter: belong to active selected meeting and not archived
    let list = issues.filter(i => i.meetingId === currentMeetingId && !i.archived);

    // 2. Signature filter
    if (selectedSignatureFilter) {
      list = list.filter(i => 
        i.signature?.toLowerCase().includes(selectedSignatureFilter.toLowerCase()) ||
        selectedSignatureFilter.toLowerCase().includes(i.signature?.toLowerCase())
      );
    }

    // 3. Category filter
    if (selectedCategoryFilter !== 'all') {
      list = list.filter(i => i.category === selectedCategoryFilter);
    }

    // 4. Priority filter
    if (selectedPriorityFilter !== 'all') {
      list = list.filter(i => i.priority === selectedPriorityFilter);
    }

    // 5. Apply sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (listSortKey === 'priority') {
        comparison = priorityWeightMap[a.priority] - priorityWeightMap[b.priority];
      } else if (listSortKey === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (listSortKey === 'status') {
        comparison = a.status.localeCompare(b.status);
      }

      return listSortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  };

  // Find active selected meeting object
  const selectedMeeting = meetings.find(m => m.id === currentMeetingId) || null;

  // Helper for Chinese weekday names
  const getWeekdayCN = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekdays[date.getDay()];
  };

  const sortedAndFilteredIssues = getSortedAndFilteredList();

  const searchedIssues = issues.filter(i => {
    if (!globalSearch) return true;
    const q = globalSearch.toLowerCase();
    return i.title.toLowerCase().includes(q) || 
           i.description?.toLowerCase().includes(q) || 
           i.category.toLowerCase().includes(q) || 
           i.signature?.toLowerCase().includes(q) ||
           i.serialNumber?.toLowerCase().includes(q);
  });

  const searchedActivities = activities.filter(a => {
    if (!globalSearch) return true;
    const q = globalSearch.toLowerCase();
    return a.title.toLowerCase().includes(q) || 
           a.description?.toLowerCase().includes(q) || 
           a.organizer.toLowerCase().includes(q) ||
           a.location?.toLowerCase().includes(q);
  });

  const searchedMeetings = meetings.filter(m => {
    if (!globalSearch) return true;
    const q = globalSearch.toLowerCase();
    return m.title.toLowerCase().includes(q) || 
           m.date.includes(q) || 
           m.regularReport?.toLowerCase().includes(q);
  });

  // Landing view
  if (!hasEntered) {
    return (
      <div className={`min-h-screen theme-${theme} bg-white text-[var(--theme-text-primary)] flex flex-col justify-center items-center p-6 md:p-12 select-none selection:bg-[var(--theme-accent)] selection:text-[var(--theme-accent-text)] transition-colors duration-700 font-serif relative overflow-hidden`}>
        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center text-center gap-8 max-w-5xl mx-auto px-4 w-full mt-12 sm:mt-16">
          
          {/* Central Logo Placeholder */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 relative flex justify-center items-center drop-shadow-2xl hover:scale-105 transition-transform duration-700">
            {/* 留出的 Logo 放置位置 */}
            <img src="/logo.png" alt="Antico Council Logo" className="w-full h-full object-contain" />
          </div>

          <div className="space-y-6">
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-widest text-[var(--theme-text-primary)] uppercase leading-none drop-shadow-md">
              安提柯议会
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-16 bg-[var(--theme-text-secondary)] opacity-50"></div>
              <p className="text-sm md:text-base font-mono text-[var(--theme-text-secondary)] tracking-[0.4em] uppercase">
                ANTICO COUNCIL
              </p>
              <div className="h-px w-16 bg-[var(--theme-text-secondary)] opacity-50"></div>
            </div>
          </div>
          
          <div className="w-full max-w-sm mt-12">
            <button
              onClick={() => setHasEntered(true)}
              className="group w-full px-8 py-5 border border-[var(--theme-border)] bg-[var(--theme-panel-bg)] backdrop-blur-md text-[var(--theme-text-primary)] font-serif text-lg tracking-widest flex items-center justify-center gap-6 hover:bg-[var(--theme-accent)] hover:text-[var(--theme-accent-text)] hover:border-[var(--theme-accent)] transition-all duration-500 cursor-pointer shadow-xl hover:shadow-2xl"
            >
              <span className="tracking-[0.2em]">进入议事大厅</span>
              <span className="font-display text-xl transform group-hover:translate-x-3 transition-transform duration-500">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen theme-${theme} bg-[var(--theme-bg)] text-[var(--theme-text-primary)] flex flex-col transition-colors duration-300 font-serif relative overflow-hidden`}>
      {/* Elegant Watermark Background */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none flex items-center justify-center fixed">
        <div className="w-[100vw] h-[100vw] max-w-[1200px] max-h-[1200px] bg-center bg-no-repeat bg-contain" style={{ backgroundImage: "url('/logo.png')" }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen w-full">
        {/* 1. TOP MARQUEE & UTILITY HEADER */}
        <div className="relative z-50 border-b-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-end gap-4 font-mono text-[10px] tracking-widest uppercase text-[var(--theme-text-secondary,#525252)]">
          <div className="flex items-center gap-4 relative">
            <div className="flex items-center gap-1.5 pl-4">
              <Clock className="w-3 h-3" />
              <span>北京时间: {currentTime.replace('T', ' ').slice(0, 19)} ({getWeekdayCN(currentTime.slice(0, 10))})</span>
            </div>
            <button
              onClick={handleExportJSON}
              title="导出全部数据 (JSON)"
              className="p-1 hover:bg-[var(--theme-accent-light)] rounded-full transition-colors border border-transparent hover:border-[var(--theme-border)]"
            >
              <Download className="w-4 h-4 text-[var(--theme-text-primary)]" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="导入数据 (JSON)"
              className="p-1 hover:bg-[var(--theme-accent-light)] rounded-full transition-colors border border-transparent hover:border-[var(--theme-border)]"
            >
              <Upload className="w-4 h-4 text-[var(--theme-text-primary)]" />
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImportJSON}
            />
            <button 
              onClick={() => setStorageMode(storageMode === 'firebase' ? 'local' : 'firebase')}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--theme-accent-light)] border border-[var(--theme-border)] hover:bg-[var(--theme-border)] hover:text-white transition-colors cursor-pointer group"
            >
              <Database className="w-3 h-3 group-hover:text-white text-[var(--theme-text-primary)]" />
              <span className="text-[10px] uppercase font-bold group-hover:text-white text-[var(--theme-text-primary)] tracking-widest">
                {storageMode === 'firebase' ? 'Firebase 云端存储' : '本地浏览器存储'}
              </span>
            </button>
            <button 
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              title="主题设置"
              className="p-1 hover:bg-[var(--theme-accent-light)] rounded-full transition-colors border border-transparent hover:border-[var(--theme-border)]"
            >
              <Settings className="w-4 h-4 text-[var(--theme-text-primary)]" />
            </button>
            {showThemeMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--theme-card-bg)] border-2 border-[var(--theme-border)] shadow-xl z-50">
                <div className="p-2 text-[10px] font-bold text-[var(--theme-text-secondary)] border-b border-neutral-200 uppercase">
                  主题配色
                </div>
                <div className="flex flex-col p-1">
                  <button onClick={() => { setTheme('classic'); localStorage.setItem('app_theme', 'classic'); setShowThemeMenu(false); }} className={`p-2 text-left text-xs ${theme === 'classic' ? 'bg-[var(--theme-accent-light)] font-bold' : 'hover:bg-[var(--theme-accent-light)]'}`}>黑白灰 (Classic)</button>
                  <button onClick={() => { setTheme('prussian'); localStorage.setItem('app_theme', 'prussian'); setShowThemeMenu(false); }} className={`p-2 text-left text-xs ${theme === 'prussian' ? 'bg-[var(--theme-accent-light)] font-bold' : 'hover:bg-[var(--theme-accent-light)]'}`}>普鲁士蓝 (Prussian)</button>
                  <button onClick={() => { setTheme('burgundy'); localStorage.setItem('app_theme', 'burgundy'); setShowThemeMenu(false); }} className={`p-2 text-left text-xs ${theme === 'burgundy' ? 'bg-[var(--theme-accent-light)] font-bold' : 'hover:bg-[var(--theme-accent-light)]'}`}>勃艮第红 (Burgundy)</button>
                  <button onClick={() => { setTheme('latenight'); localStorage.setItem('app_theme', 'latenight'); setShowThemeMenu(false); }} className={`p-2 text-left text-xs ${theme === 'latenight' ? 'bg-[var(--theme-accent-light)] font-bold' : 'hover:bg-[var(--theme-accent-light)]'}`}>深夜护眼 (Late Night)</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. CHIEF BRANDING HERO */}
      <header className="border-b-2 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] backdrop-blur-md py-8 sm:py-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-8 space-y-2">
            <div className="flex items-baseline flex-wrap gap-x-4 gap-y-2">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-normal tracking-wide text-[var(--theme-text-primary,#171717)] leading-none uppercase">
                安提柯议会
              </h1>
              <span className="font-mono text-sm text-[var(--theme-text-secondary,#525252)] tracking-widest uppercase">
                ANTICO COUNCIL {selectedMeeting ? ` | ${selectedMeeting.date} ${selectedMeeting.week}` : ' | 暂无活跃周期'}
              </span>
            </div>
          </div>
          
          <div className="lg:col-span-4 flex justify-start lg:justify-end gap-3 font-mono text-xs items-center">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-secondary)]" />
              <input
                type="text"
                placeholder="全局搜索..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)] shadow-sm"
              />
            </div>
            <span className="px-3 py-1.5 bg-[var(--theme-accent-light)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] font-bold hidden sm:block">
              {activeTab === 'session' ? '召开会议阶段' : activeTab === 'post' ? '会后执行阶段' : activeTab === 'supervision' ? '全局督办审查' : activeTab === 'activity' ? '活动行事历' : '历史档案审查'}
            </span>
          </div>
        </div>
      </header>

      {/* 3. CORE ASSEMBLY WORKSPACE */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* TOP SECTION: CYCLE MANAGER */}
        <div>
          <MeetingManager
            meetings={meetings}
            issues={issues}
            members={members}
            currentMeetingId={currentMeetingId}
            onSelectMeeting={setCurrentMeetingId}
            onAddMeeting={handleAddMeeting}
            onUpdateMeetingSummary={handleUpdateMeetingSummary}
            onDeleteMeeting={handleDeleteMeeting}
          />
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex border-b-2 border-[var(--theme-border,#171717)]">
          <button
            onClick={() => setActiveTab('session')}
            className={`px-6 py-3 font-display text-sm font-bold tracking-wider uppercase transition-colors flex items-center gap-2 ${
              activeTab === 'session'
                ? 'border-t-2 border-l-2 border-r-2 border-b-0 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] text-[var(--theme-text-primary)] mb-[-2px]'
                : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] border-b-2 border-transparent'
            }`}
          >
            <Gavel className="w-4 h-4" />
            召开议会
          </button>
          <button
            onClick={() => setActiveTab('post')}
            className={`px-6 py-3 font-display text-sm font-bold tracking-wider uppercase transition-colors flex items-center gap-2 ${
              activeTab === 'post'
                ? 'border-t-2 border-l-2 border-r-2 border-b-0 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] text-[var(--theme-text-primary)] mb-[-2px]'
                : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] border-b-2 border-transparent'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            会后执行
          </button>
          <button
            onClick={() => setActiveTab('supervision')}
            className={`px-6 py-3 font-display text-sm font-bold tracking-wider uppercase transition-colors flex items-center gap-2 ${
              activeTab === 'supervision'
                ? 'border-t-2 border-l-2 border-r-2 border-b-0 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] text-[var(--theme-text-primary)] mb-[-2px]'
                : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] border-b-2 border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            全局督办
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-6 py-3 font-display text-sm font-bold tracking-wider uppercase transition-colors flex items-center gap-2 ${
              activeTab === 'activity'
                ? 'border-t-2 border-l-2 border-r-2 border-b-0 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] text-[var(--theme-text-primary)] mb-[-2px]'
                : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] border-b-2 border-transparent'
            }`}
          >
            <Calendar className="w-4 h-4" />
            活动
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-6 py-3 font-display text-sm font-bold tracking-wider uppercase transition-colors flex items-center gap-2 ${
              activeTab === 'archive'
                ? 'border-t-2 border-l-2 border-r-2 border-b-0 border-[var(--theme-border,#171717)] bg-[var(--theme-panel-bg,rgba(255,255,255,0.75))] text-[var(--theme-text-primary)] mb-[-2px]'
                : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-accent-light)] border-b-2 border-transparent'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            历届档案
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="pt-6">
          {activeTab === 'session' && (
            <SessionView 
              currentMeeting={selectedMeeting} 
              issues={searchedIssues} 
              onAddIssue={handleStartAddIssue} 
              onUpdateIssue={handleSaveIssue} 
              onUpdateMeetingRegularReport={handleUpdateMeetingRegularReport} 
            />
          )}

          {activeTab === 'post' && (
            <PostMeetingView 
              issues={searchedIssues.filter(i => i.meetingId === currentMeetingId)} 
              members={members} 
              onUpdateIssue={handleSaveIssue} 
              onOpenDetail={(issue) => {
                setIsAddingNew(false);
                setActiveIssueForDetail(issue);
              }} 
            />
          )}

          {activeTab === 'archive' && (
            <ArchiveView 
              meetings={searchedMeetings} 
              issues={searchedIssues} 
              onOpenDetail={(issue) => {
                setIsAddingNew(false);
                setActiveIssueForDetail(issue);
              }} 
              onDeleteMeeting={handleDeleteMeeting}
              selectedMeetingIdsForExport={selectedMeetingIdsForExport}
              onToggleMeetingExportSelection={handleToggleMeetingExportSelection}
              onExportLatex={handleExportLatex}
              onExportPDF={handleExportPDF}
              isCompiling={isCompiling}
            />
          )}

          {activeTab === 'supervision' && (
            <SupervisionView 
              meetings={searchedMeetings} 
              issues={searchedIssues} 
              onOpenDetail={(issue) => {
                setIsAddingNew(false);
                setActiveIssueForDetail(issue);
              }} 
            />
          )}

          {activeTab === 'activity' && (
            <ActivityView
              activities={searchedActivities}
              onAddActivity={handleAddActivity}
              onDeleteActivity={handleDeleteActivity}
            />
          )}
        </div>
      </main>

      {/* 4. FOOTER: Strict Minimal Layout */}
      <footer className="border-t border-neutral-200 bg-white py-6 mt-auto">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center text-neutral-400 font-mono text-[10px] gap-2">
        </div>
      </footer>
      </div>

      {/* 5. MODALS & DIALOGS */}
      

      {activeIssueForDetail && (
        <IssueDetailModal
          issue={activeIssueForDetail}
          members={members}
          categories={DEFAULT_DEPARTMENTS}
          onClose={() => {
            setActiveIssueForDetail(null);
            setIsAddingNew(false);
          }}
          onUpdate={handleSaveIssue}
          onDelete={handleDeleteIssue}
        />
      )}

      {/* 6. HIGH-FIDELITY PRINT-READY VISIBLE-BUT-OFFSCREEN CONTAINER FOR PDF GENERATION */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px' }}>
        <div id="pdf-compile-preview" className="w-[800px] bg-white p-12 text-neutral-950 font-sans space-y-10">
          
          {/* Cover Header */}
          <div className="text-center border-b-4 border-neutral-950 pb-8 space-y-4">
            <h1 className="font-serif text-4xl font-bold tracking-widest uppercase">
              议事会议纪要与决议公报
            </h1>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">
              Assembly Compilation & Resolution Bulletin
            </p>
            <div className="flex justify-center gap-8 text-xs font-mono text-neutral-500 pt-4 border-t border-neutral-100 max-w-md mx-auto">
              <div>发布日期: {new Date().toLocaleDateString('zh-CN')}</div>
              <div>包含周期: {meetings.filter(m => selectedMeetingIdsForExport.includes(m.id)).length} 期</div>
            </div>
          </div>

          {/* Compilation Contents */}
          <div className="space-y-10">
            {meetings.filter(m => selectedMeetingIdsForExport.includes(m.id)).map((m, idx) => {
              const mIssues = issues.filter(i => i.meetingId === m.id);
              return (
                <div key={m.id} className="space-y-6 pb-8 border-b-2 border-neutral-200 last:border-b-0 last:pb-0">
                  <div className="flex justify-between items-end border-b border-neutral-950 pb-2">
                    <h2 className="font-serif text-xl font-bold text-neutral-950">
                      {idx + 1}. {m.title} ({m.week})
                    </h2>
                    <span className="font-mono text-xs text-neutral-500">召开日期: {m.date}</span>
                  </div>

                  {/* Regular report */}
                  <div className="space-y-2">
                    <h3 className="font-sans text-xs font-bold text-neutral-700 uppercase tracking-widest">
                      【常规报告】
                    </h3>
                    <div className="text-xs text-neutral-800 leading-relaxed font-serif bg-neutral-50 p-4 border border-neutral-200 whitespace-pre-wrap">
                      {m.regularReport || '暂无常规报告。'}
                    </div>
                  </div>

                  {/* Issues List */}
                  <div className="space-y-3">
                    <h3 className="font-sans text-xs font-bold text-neutral-700 uppercase tracking-widest">
                      【会商决议明细】
                    </h3>
                    {mIssues.length === 0 ? (
                      <p className="text-xs text-neutral-400 font-mono italic p-2 border border-dashed border-neutral-200">
                        本期例会无关联的议题。
                      </p>
                    ) : (
                      <div className="border border-neutral-950 divide-y divide-neutral-950">
                        {mIssues.map((issue, issueIdx) => (
                          <div key={issue.id} className="p-4 bg-white space-y-2.5">
                            <div className="flex justify-between items-baseline">
                              <div className="font-bold font-serif text-neutral-950 text-sm">
                                ({issueIdx + 1}) 《{issue.title}》
                              </div>
                              <span className="font-mono text-[9px] uppercase border border-neutral-950 px-2 py-0.5 bg-neutral-100">
                                {issue.status === 'completed' ? '归档完成' : issue.status === 'execution' ? '执行' : issue.status === 'authorization' ? '授权' : '议程'}
                              </span>
                            </div>
                            
                            {issue.description && (
                              <p className="text-neutral-700 font-sans text-xs leading-normal">
                                <span className="font-bold text-neutral-500">事项描述:</span> {issue.description}
                              </p>
                            )}
                            
                            {issue.discussion && (
                              <div className="bg-neutral-50 p-3 border border-neutral-200 font-serif text-xs leading-normal">
                                <span className="font-bold font-sans text-[10px] text-neutral-500 block mb-1">会商结论:</span>
                                {issue.discussion}
                              </div>
                            )}
                            
                            <div className="text-[10px] font-mono text-neutral-500 flex justify-between pt-1 border-t border-neutral-100">
                              <div>类别: <span className="text-neutral-800">{issue.category}</span></div>
                              <div>负责人/经办人: <span className="font-bold text-neutral-950">{issue.signature || '待指派'}</span></div>
                              <div>优先级: <span className={issue.priority === 'urgent' ? 'text-red-600 font-bold' : 'text-neutral-800'}>
                                {issue.priority === 'urgent' ? '紧急' : issue.priority === 'high' ? '高' : issue.priority === 'medium' ? '中' : '低'}
                              </span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Autograph / Handstamp area */}
          <div className="pt-10 border-t-4 border-neutral-950 space-y-6">
            <p className="text-xs text-neutral-400 font-mono text-center">
              * 全体成员鉴章：见公报如面，各尽其职，对以上所列各项决议负责。
            </p>
            <div className="grid grid-cols-3 gap-8 pt-10 text-center text-xs font-serif text-neutral-800">
              <div className="space-y-14">
                <div className="border-b border-neutral-300 w-44 mx-auto" />
                <div className="font-bold tracking-wider">主事人鉴字盖章</div>
              </div>
              <div className="space-y-14">
                <div className="border-b border-neutral-300 w-44 mx-auto" />
                <div className="font-bold tracking-wider">监察委员鉴字盖章</div>
              </div>
              <div className="space-y-14">
                <div className="border-b border-neutral-300 w-44 mx-auto" />
                <div className="font-bold tracking-wider">经办代表鉴字盖章</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
