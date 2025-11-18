import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reminder } from '../types';

interface ReminderCardProps {
  reminder: Reminder;
  onDelete: () => void;
  onToggleStatus: () => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onDelete,
  onToggleStatus,
}) => {
  const dateTime = parseISO(reminder.datetime_iso);
  const isCompleted = reminder.status === 'completed';
  const isPast = dateTime < new Date() && !isCompleted;

  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted, isPast && styles.cardPast]}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={onToggleStatus}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={isCompleted ? '#10b981' : '#6b7280'}
        />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, isCompleted && styles.titleCompleted]}>
          {reminder.title}
        </Text>
        {reminder.description && (
          <Text style={styles.description}>{reminder.description}</Text>
        )}
        <View style={styles.dateTimeRow}>
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text style={styles.dateTime}>
            {format(dateTime, "EEEE d MMMM 'à' HH:mm", { locale: fr })}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={onDelete}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardCompleted: {
    backgroundColor: '#f0fdf4',
    opacity: 0.7,
  },
  cardPast: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  checkbox: {
    marginRight: 12,
    paddingTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTime: {
    fontSize: 14,
    color: '#6b7280',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
});
