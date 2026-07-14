export type Priority = 'عالية' | 'متوسطة' | 'منخفضة';
export type Status = 'جديد' | 'الحاقي' | 'مغلق';

export interface Letter {
  id: number;
  entity_source: string;
  letter_number: string;
  letter_date: string;
  category: string;
  responsible_department: string;
  owner: string;
  priority: Priority;
  due_date: string;
  status: Status;
  escalation: string;
  action_taken?: string;
  close_date?: string;
  outgoing_letter_number?: string;
  outgoing_letter_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'manager' | 'staff';
}

export interface Meeting {
  id: number;
  actionType: 'إجتماع' | 'زيارة' | 'لجنة';
  topic: string;
  date: string;
  time: string;
  location: string;
  status: 'تحت الاجراء' | 'منتهي';
  createdAt: string;
}

export interface DashboardStats {
  totalOpen: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  recentLetters?: Letter[];
  openLetters?: Letter[];
  overdueLetters?: Letter[];
  dueTodayLetters?: Letter[];
  dueThisWeekLetters?: Letter[];
  priorityCounts?: { priority: string; count: number }[];
}
