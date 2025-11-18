export interface ParsedReminder {
  title: string;
  description: string | null;
  date: string | null;
  time: string | null;
  datetime_iso: string | null;
  timezone: string;
  is_ambiguous: boolean;
  ambiguity_reason: string | null;
}

export interface Reminder {
  id: string;
  title: string;
  description: string | null;
  datetime_iso: string;
  timezone: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  recurrence: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderCreate {
  title: string;
  description: string | null;
  datetime_iso: string;
  timezone: string;
  recurrence: string | null;
}
