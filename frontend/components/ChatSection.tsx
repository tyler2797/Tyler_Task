import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface ChatSectionProps {
  messages: Message[];
  inputValue: string;
  onInputChange: (text: string) => void;
  onSend: () => void;
  loading: boolean;
}

export const ChatSection: React.FC<ChatSectionProps> = ({
  messages,
  inputValue,
  onInputChange,
  onSend,
  loading,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="chatbubbles" size={24} color={COLORS.neon.cyan} />
        <Text style={styles.headerText}>TERMINAL</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>// Créez votre premier rappel</Text>
            <Text style={styles.emptySubtext}>
              Ex: "demain 15h appeler Paul"
            </Text>
          </View>
        )}
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.messageRow,
              msg.type === 'user' ? styles.userRow : styles.assistantRow,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                msg.type === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  msg.type === 'user'
                    ? styles.userText
                    : styles.assistantText,
                ]}
              >
                {msg.text}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="> Entrez votre commande..."
            placeholderTextColor={COLORS.text.muted}
            value={inputValue}
            onChangeText={onInputChange}
            multiline
            maxLength={200}
          />
        </View>
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={loading || !inputValue.trim()}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.background.primary} size="small" />
          ) : (
            <Ionicons name="send" size={20} color={COLORS.background.primary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neon.cyan + '40',
    gap: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.neon.cyan,
    letterSpacing: 2,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.text.secondary,
    fontFamily: 'monospace',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.text.muted,
    marginTop: 8,
  },
  messageRow: {
    marginBottom: 12,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: COLORS.background.card,
    borderColor: COLORS.neon.magenta + '80',
  },
  assistantBubble: {
    backgroundColor: COLORS.background.card,
    borderColor: COLORS.neon.cyan + '80',
  },
  messageText: {
    fontSize: 15,
  },
  userText: {
    color: COLORS.text.primary,
  },
  assistantText: {
    color: COLORS.neon.cyan,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.neon.cyan + '40',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.background.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.neon.cyan + '40',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 15,
    color: COLORS.text.primary,
    minHeight: 44,
    fontFamily: 'monospace',
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: COLORS.neon.cyan,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.neon.cyan,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.background.card,
    borderColor: COLORS.text.muted,
  },
});
