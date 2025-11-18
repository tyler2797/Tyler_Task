import { create } from 'zustand';
import { Reminder } from '../types';
import * as api from '../services/api';

interface RemindersState {
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  fetchReminders: () => Promise<void>;
  addReminder: (reminder: Reminder) => void;
  removeReminder: (id: string) => Promise<void>;
  updateReminderStatus: (id: string, status: string) => Promise<void>;
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],
  loading: false,
  error: null,

  fetchReminders: async () => {
    set({ loading: true, error: null });
    try {
      const reminders = await api.getReminders();
      set({ reminders, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addReminder: (reminder: Reminder) => {
    set((state) => ({
      reminders: [reminder, ...state.reminders],
    }));
  },

  removeReminder: async (id: string) => {
    try {
      await api.deleteReminder(id);
      set((state) => ({
        reminders: state.reminders.filter((r) => r.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  updateReminderStatus: async (id: string, status: string) => {
    try {
      const updated = await api.updateReminderStatus(id, status);
      set((state) => ({
        reminders: state.reminders.map((r) =>
          r.id === id ? updated : r
        ),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },
}));
