import axios from 'axios';
import Constants from 'expo-constants';
import { Reminder, ReminderCreate, ParsedReminder } from '../types';

const API_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL + '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const parseMessage = async (message: string): Promise<ParsedReminder> => {
  const response = await api.post('/parse-message', { message });
  return response.data;
};

export const createReminder = async (reminder: ReminderCreate): Promise<Reminder> => {
  const response = await api.post('/reminders', reminder);
  return response.data;
};

export const getReminders = async (status?: string): Promise<Reminder[]> => {
  const params = status ? { status } : {};
  const response = await api.get('/reminders', { params });
  return response.data;
};

export const deleteReminder = async (id: string): Promise<void> => {
  await api.delete(`/reminders/${id}`);
};

export const updateReminderStatus = async (id: string, status: string): Promise<Reminder> => {
  const response = await api.patch(`/reminders/${id}`, { status });
  return response.data;
};
