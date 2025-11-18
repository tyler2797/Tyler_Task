import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reminder } from '../types';
import { COLORS } from '../constants/theme';

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
    <View
      style={[
        styles.card,
        isCompleted && styles.cardCompleted,
        isPast && styles.cardPast,
      ]}
    >
      <TouchableOpacity
        style={styles.checkbox}
        onPress={onToggleStatus}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={isCompleted ? COLORS.status.success : COLORS.neon.cyan}
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
          <Ionicons name="time-outline" size={16} color={COLORS.neon.magenta} />
          <Text style={styles.dateTime}>
            {format(dateTime, "EEEE d MMMM 'à' HH:mm", { locale: fr })}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isCompleted ? COLORS.status.success : COLORS.neon.cyan },
            ]}
          />
          <Text style={styles.statusText}>
            {isCompleted ? 'COMPLÉTÉ' : isPast ? 'EN RETARD' : 'ACTIF'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={onDelete}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color={COLORS.status.error} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.neon.cyan + '40',
  },
  cardCompleted: {
    opacity: 0.6,
    borderColor: COLORS.status.success + '40',
  },
  cardPast: {
    borderColor: COLORS.status.warning,
    borderLeftWidth: 3,
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
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.text.secondary,
  },
  description: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.neon.cyan,
    letterSpacing: 1,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
});
