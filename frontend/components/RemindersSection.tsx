import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../types';
import { ReminderCard } from './ReminderCard';
import { COLORS } from '../constants/theme';

interface RemindersSectionProps {
  reminders: Reminder[];
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
}

type Filter = 'all' | 'scheduled' | 'completed';

export const RemindersSection: React.FC<RemindersSectionProps> = ({
  reminders,
  onDelete,
  onToggleStatus,
}) => {
  const [filter, setFilter] = useState<Filter>('all');

  const filteredReminders = reminders.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const scheduledCount = reminders.filter((r) => r.status === 'scheduled').length;
  const completedCount = reminders.filter((r) => r.status === 'completed').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="list" size={24} color={COLORS.neon.magenta} />
          <Text style={styles.headerText}>RAPPELS</Text>
        </View>
        <Text style={styles.count}>{filteredReminders.length}</Text>
      </View>

      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'all' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'all' && styles.filterTextActive,
            ]}
          >
            TOUS ({reminders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'scheduled' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('scheduled')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'scheduled' && styles.filterTextActive,
            ]}
          >
            À VENIR ({scheduledCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'completed' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('completed')}
        >
          <Text
            style={[
              styles.filterText,
              filter === 'completed' && styles.filterTextActive,
            ]}
          >
            PASSÉS ({completedCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredReminders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={COLORS.text.muted} />
            <Text style={styles.emptyText}>// Aucun rappel</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all'
                ? 'Créez votre premier rappel ci-dessus'
                : `Aucun rappel ${filter === 'scheduled' ? 'à venir' : 'complété'}`}
            </Text>
          </View>
        ) : (
          filteredReminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onDelete={() => onDelete(reminder.id)}
              onToggleStatus={() => onToggleStatus(reminder.id, reminder.status)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neon.magenta + '40',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.neon.magenta,
    letterSpacing: 2,
  },
  count: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.neon.cyan,
    fontFamily: 'monospace',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.text.muted + '40',
  },
  filterButtonActive: {
    borderColor: COLORS.neon.cyan,
    backgroundColor: COLORS.background.card,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.muted,
    letterSpacing: 1,
  },
  filterTextActive: {
    color: COLORS.neon.cyan,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 16,
    fontFamily: 'monospace',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.text.muted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
