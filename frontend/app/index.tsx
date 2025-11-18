import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { parseISO } from 'date-fns';

import { useRemindersStore } from '../store/remindersStore';
import { ReminderCard } from '../components/ReminderCard';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ParsedReminder } from '../types';
import * as api from '../services/api';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function Index() {
  const [message, setMessage] = useState('');
  const [parsedReminder, setParsedReminder] = useState<ParsedReminder | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const { reminders, fetchReminders, addReminder, removeReminder, updateReminderStatus } =
    useRemindersStore();

  useEffect(() => {
    requestNotificationPermissions();
    fetchReminders();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setHasPermission(finalStatus === 'granted');

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Permissions requises',
        'Les notifications sont nécessaires pour recevoir vos rappels.'
      );
    }
  };

  const scheduleNotification = async (reminder: any) => {
    if (!hasPermission) return;

    const trigger = parseISO(reminder.datetime_iso);
    const now = new Date();

    if (trigger <= now) {
      console.log('Notification date is in the past, not scheduling');
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Rappel',
          body: reminder.title,
          data: { reminderId: reminder.id },
          sound: true,
        },
        trigger,
      });
      console.log('Notification scheduled for', trigger);
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  const handleParseMessage = async () => {
    if (!message.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message');
      return;
    }

    setLoading(true);
    try {
      const parsed = await api.parseMessage(message);
      setParsedReminder(parsed);
      setShowConfirmation(true);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de parser le message');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReminder = async () => {
    if (!parsedReminder || !parsedReminder.datetime_iso) {
      Alert.alert('Erreur', 'Informations du rappel incomplètes');
      return;
    }

    setLoading(true);
    try {
      const newReminder = await api.createReminder({
        title: parsedReminder.title,
        description: parsedReminder.description,
        datetime_iso: parsedReminder.datetime_iso,
        timezone: parsedReminder.timezone,
        recurrence: null,
      });

      addReminder(newReminder);
      await scheduleNotification(newReminder);

      setMessage('');
      setParsedReminder(null);
      setShowConfirmation(false);

      Alert.alert('Succès', 'Rappel créé avec succès!');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de créer le rappel');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setParsedReminder(null);
  };

  const handleDeleteReminder = async (id: string) => {
    Alert.alert(
      'Supprimer le rappel',
      'Êtes-vous sûr de vouloir supprimer ce rappel ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await removeReminder(id);
            // Cancel notification
            const notifications = await Notifications.getAllScheduledNotificationsAsync();
            const notification = notifications.find((n) => n.content.data?.reminderId === id);
            if (notification) {
              await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'scheduled' : 'completed';
    await updateReminderStatus(id, newStatus);
  };

  const scheduledReminders = reminders.filter((r) => r.status === 'scheduled');
  const completedReminders = reminders.filter((r) => r.status === 'completed');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Ionicons name="notifications" size={32} color="#3b82f6" />
            <Text style={styles.headerTitle}>Mes Rappels</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Créez un rappel en langage naturel
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Ionicons name="chatbubble-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ex: Demain 15h appeler Paul pour la facture"
              placeholderTextColor="#9ca3af"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={200}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
            onPress={handleParseMessage}
            disabled={loading || !message.trim()}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {scheduledReminders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À venir</Text>
              {scheduledReminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onDelete={() => handleDeleteReminder(reminder.id)}
                  onToggleStatus={() => handleToggleStatus(reminder.id, reminder.status)}
                />
              ))}
            </View>
          )}

          {completedReminders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Complétés</Text>
              {completedReminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onDelete={() => handleDeleteReminder(reminder.id)}
                  onToggleStatus={() => handleToggleStatus(reminder.id, reminder.status)}
                />
              ))}
            </View>
          )}

          {reminders.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyStateText}>Aucun rappel</Text>
              <Text style={styles.emptyStateSubtext}>
                Créez votre premier rappel en utilisant le champ ci-dessus
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmationModal
        visible={showConfirmation}
        parsed={parsedReminder}
        onConfirm={handleConfirmReminder}
        onCancel={handleCancelConfirmation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    minHeight: 44,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
