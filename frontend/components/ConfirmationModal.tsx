import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ParsedReminder } from '../types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConfirmationModalProps {
  visible: boolean;
  parsed: ParsedReminder | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  parsed,
  onConfirm,
  onCancel,
}) => {
  if (!parsed) return null;

  const dateTime = parsed.datetime_iso ? parseISO(parsed.datetime_iso) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Ionicons name="checkmark-circle" size={40} color="#10b981" />
              <Text style={styles.headerText}>Confirmer le rappel ?</Text>
            </View>

            <View style={styles.content}>
              <View style={styles.infoRow}>
                <Ionicons name="pencil" size={20} color="#6b7280" />
                <Text style={styles.label}>Titre:</Text>
                <Text style={styles.value}>{parsed.title}</Text>
              </View>

              {parsed.description && (
                <View style={styles.infoRow}>
                  <Ionicons name="document-text" size={20} color="#6b7280" />
                  <Text style={styles.label}>Description:</Text>
                  <Text style={styles.value}>{parsed.description}</Text>
                </View>
              )}

              {dateTime && (
                <View style={styles.infoRow}>
                  <Ionicons name="time" size={20} color="#6b7280" />
                  <Text style={styles.label}>Date & Heure:</Text>
                  <Text style={styles.value}>
                    {format(dateTime, "EEEE d MMMM yyyy 'à' HH:mm", {
                      locale: fr,
                    })}
                  </Text>
                </View>
              )}

              {parsed.is_ambiguous && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    {parsed.ambiguity_reason || 'Certaines informations ne sont pas claires'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },
  content: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    minWidth: 80,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
