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
import { COLORS } from '../constants/theme';

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
              <View style={styles.glitchLine} />
              <Ionicons name="alert-circle" size={40} color={COLORS.neon.cyan} />
              <Text style={styles.headerText}>CONFIRMATION</Text>
              <View style={styles.glitchLine} />
            </View>

            <View style={styles.content}>
              <View style={styles.infoRow}>
                <Text style={styles.label}>// TITRE</Text>
                <Text style={styles.value}>{parsed.title}</Text>
              </View>

              {parsed.description && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>// DESCRIPTION</Text>
                  <Text style={styles.value}>{parsed.description}</Text>
                </View>
              )}

              {dateTime && (
                <View style={styles.infoRow}>
                  <Text style={styles.label}>// HORODATAGE</Text>
                  <Text style={styles.value}>
                    {format(dateTime, "EEEE d MMMM yyyy 'à' HH:mm", {
                      locale: fr,
                    })}
                  </Text>
                </View>
              )}

              {parsed.is_ambiguous && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color={COLORS.status.warning} />
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
                <Text style={styles.cancelButtonText}>ANNULER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>EXÉCUTER</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modal: {
    backgroundColor: COLORS.background.card,
    borderRadius: 12,
    padding: 24,
    borderWidth: 2,
    borderColor: COLORS.neon.cyan + '80',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  glitchLine: {
    width: 100,
    height: 2,
    backgroundColor: COLORS.neon.cyan,
    marginVertical: 8,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.neon.cyan,
    marginVertical: 8,
    letterSpacing: 3,
  },
  content: {
    marginBottom: 24,
  },
  infoRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.neon.magenta,
    marginBottom: 4,
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  value: {
    fontSize: 15,
    color: COLORS.text.primary,
    lineHeight: 22,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background.secondary,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.status.warning + '40',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.status.warning,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: COLORS.background.secondary,
    borderColor: COLORS.text.muted + '40',
  },
  confirmButton: {
    backgroundColor: COLORS.neon.cyan,
    borderColor: COLORS.neon.cyan,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.secondary,
    letterSpacing: 1,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.background.primary,
    letterSpacing: 1,
  },
});
