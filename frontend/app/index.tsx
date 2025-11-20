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
import { SuggestionButtons } from '../components/SuggestionButtons';
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
  suggestions?: string[];
}

export default function Index() {
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [parsedReminder, setParsedReminder] = useState<ParsedReminder | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[] | null>(null);

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

  const addChatMessage = (type: 'user' | 'assistant', text: string, suggestions?: string[]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      text,
      timestamp: new Date(),
      suggestions,
    };
    setChatMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un message');
      return;
    }

    const userMessage = message;
    addChatMessage('user', userMessage);

    // Create updated history with current message BEFORE API call
    const updatedHistory = [...conversationHistory, { role: 'user', content: userMessage }];

    // Update conversation history state
    setConversationHistory(updatedHistory);

    setMessage('');
    setLoading(true);

    try {
      // Send the UPDATED history to the backend
      const chatResponse = await api.chatWithAssistant(userMessage, updatedHistory);

      // Add assistant response to chat
      addChatMessage('assistant', chatResponse.response, chatResponse.suggestions || undefined);

      // Update conversation history with assistant response
      setConversationHistory((prev) => [
        ...prev,
        { role: 'assistant', content: chatResponse.response },
      ]);

      // Set current suggestions
      setCurrentSuggestions(chatResponse.suggestions);

      // If we have parsed reminders, show confirmation
      if (chatResponse.parsed_reminders && chatResponse.parsed_reminders.length > 0) {
        setParsedReminder(chatResponse.parsed_reminders[0]);
        setShowConfirmation(true);
      }

    } catch (error: any) {
      addChatMessage('assistant', `❌ Erreur: ${error.message || 'Impossible de communiquer avec l\'assistant'}`);
      Alert.alert('Erreur', error.message || 'Impossible de communiquer avec l\'assistant');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    setCurrentSuggestions(null);
    // Auto-send the suggestion
    setTimeout(() => {
      setMessage(suggestion);
      handleSendMessage();
    }, 100);
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

      addChatMessage('assistant', `✓ Rappel créé: "${newReminder.title}" 🎉`);

      setParsedReminder(null);
      setShowConfirmation(false);
      setCurrentSuggestions(null);

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
    addChatMessage('assistant', '✕ Création de rappel annulée. Pas de souci! 😊');
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
            onSend={handleSendMessage}
            loading={loading}
          />
          {currentSuggestions && (
            <View style={styles.suggestionsContainer}>
              <SuggestionButtons
                suggestions={currentSuggestions}
                onSelect={handleSuggestionClick}
              />
            </View>
          )}
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
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neon.cyan + '20',
  },
  remindersSection: {
    flex: 3,
  },
});
