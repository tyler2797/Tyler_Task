import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { parseISO } from 'date-fns';

import { useRemindersStore } from '../store/remindersStore';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ChatSection } from '../components/ChatSection';
import { RemindersSection } from '../components/RemindersSection';
import { ParsedReminder } from '../types';
import * as api from '../services/api';
import { COLORS } from '../constants/theme';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function Index() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
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

  const addChatMessage = (type: 'user' | 'assistant', text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, newMessage]);
  };

  const handleParseMessage = async () => {
    if (!message.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message');
      return;
    }

    // Add user message to chat
    addChatMessage('user', message);

    setLoading(true);
    try {
      const parsed = await api.parseMessage(message);
      setParsedReminder(parsed);
      
      // Add assistant confirmation message
      const confirmText = `> Rappel détecté:\n• ${parsed.title}\n• ${parsed.date} à ${parsed.time || 'heure non spécifiée'}${parsed.is_ambiguous ? '\n⚠ Vérification nécessaire' : ''}`;
      addChatMessage('assistant', confirmText);
      
      setShowConfirmation(true);
    } catch (error: any) {
      addChatMessage('assistant', `❌ Erreur: ${error.message || 'Impossible de parser le message'}`);
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

      // Add success message to chat
      addChatMessage('assistant', `✓ Rappel créé: "${newReminder.title}"`);

      setMessage('');
      setParsedReminder(null);
      setShowConfirmation(false);

      Alert.alert('Succès', 'Rappel créé avec succès!');
    } catch (error: any) {
      addChatMessage('assistant', `❌ Échec de création: ${error.message}`);
      Alert.alert('Erreur', error.message || 'Impossible de créer le rappel');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setParsedReminder(null);
    addChatMessage('assistant', '✕ Création de rappel annulée');
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.chatSection}>
          <ChatSection
            messages={chatMessages}
            inputValue={message}
            onInputChange={setMessage}
            onSend={handleParseMessage}
            loading={loading}
          />
        </View>

        <View style={styles.remindersSection}>
          <RemindersSection
            reminders={reminders}
            onDelete={handleDeleteReminder}
            onToggleStatus={handleToggleStatus}
          />
        </View>
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
    backgroundColor: COLORS.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  chatSection: {
    flex: 2,
    minHeight: 300,
  },
  remindersSection: {
    flex: 3,
  },
});
