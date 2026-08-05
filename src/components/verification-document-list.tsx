import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { VerificationDocument, VerificationRequest } from '@/lib/types';
import {
  createVerificationDocumentUrl,
  listVerificationDocuments,
  MAX_VERIFICATION_DOCUMENTS,
  removeVerificationDocument,
  uploadVerificationDocument,
} from '@/lib/verificationDocuments';

type Props = {
  request: VerificationRequest;
  editable?: boolean;
};

export default function VerificationDocumentList({ request, editable = false }: Props) {
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const result = await listVerificationDocuments(request);
    if (result.error) setFeedback(result.error);
    else {
      setDocuments(result.data ?? []);
      setFeedback(null);
    }
    setLoading(false);
  }, [request]);

  useEffect(() => {
    const timeout = setTimeout(() => void loadDocuments(), 0);
    return () => clearTimeout(timeout);
  }, [loadDocuments]);

  const pickAndUpload = async () => {
    if (documents.length >= MAX_VERIFICATION_DOCUMENTS) {
      Alert.alert('Document limit reached', `You can attach up to ${MAX_VERIFICATION_DOCUMENTS} files.`);
      return;
    }

    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled) return;

    setUploading(true);
    setFeedback(null);
    const result = await uploadVerificationDocument(request, picked.assets[0]);
    setUploading(false);
    if (result.error) {
      setFeedback(result.error);
      return;
    }
    await loadDocuments();
  };

  const openDocument = async (document: VerificationDocument) => {
    setFeedback(null);
    const result = await createVerificationDocumentUrl(document);
    if (result.error || !result.data) {
      setFeedback(result.error ?? 'The document could not be opened.');
      return;
    }
    await Linking.openURL(result.data);
  };

  const confirmRemove = (document: VerificationDocument) => {
    Alert.alert('Remove verification document?', document.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingPath(document.path);
          setFeedback(null);
          const result = await removeVerificationDocument(document.path);
          setRemovingPath(null);
          if (result.error) setFeedback(result.error);
          else setDocuments((current) => current.filter((item) => item.path !== document.path));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Verification documents</Text>
          <Text style={styles.subtitle}>
            Private PDF, JPEG, or PNG evidence · 5 MB per file
          </Text>
        </View>
        <View style={styles.privateBadge}>
          <Ionicons name="lock-closed" size={12} color={Colors.success} />
          <Text style={styles.privateText}>Private</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.stateText}>Loading documents…</Text>
        </View>
      ) : documents.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-outline" size={24} color={Colors.textSubtle} />
          <Text style={styles.stateText}>No documents attached.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {documents.map((document) => (
            <View key={document.id} style={styles.documentRow}>
              <View style={styles.documentIcon}>
                <Ionicons
                  name={document.mimeType === 'application/pdf' ? 'document-text' : 'image'}
                  size={20}
                  color={Colors.primary}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void openDocument(document)}
                style={({ pressed }) => [styles.documentCopy, pressed && styles.pressed]}
              >
                <Text style={styles.documentName} numberOfLines={1}>{document.name}</Text>
                <Text style={styles.documentMeta}>{formatFileSize(document.size)}</Text>
              </Pressable>
              {editable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${document.name}`}
                  disabled={Boolean(removingPath) || uploading}
                  onPress={() => confirmRemove(document)}
                  style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                >
                  {removingPath === document.path ? (
                    <ActivityIndicator size="small" color={Colors.danger} />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  )}
                </Pressable>
              ) : (
                <Ionicons name="open-outline" size={18} color={Colors.primary} />
              )}
            </View>
          ))}
        </View>
      )}

      {feedback ? (
        <View style={styles.feedback}>
          <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: uploading, disabled: uploading || documents.length >= MAX_VERIFICATION_DOCUMENTS }}
          disabled={uploading || documents.length >= MAX_VERIFICATION_DOCUMENTS}
          onPress={() => void pickAndUpload()}
          style={({ pressed }) => [
            styles.uploadButton,
            (uploading || documents.length >= MAX_VERIFICATION_DOCUMENTS) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {uploading ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={19} color={Colors.textOnPrimary} />
              <Text style={styles.uploadText}>
                {documents.length ? 'Attach another document' : 'Attach a document'}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      <Text style={styles.privacyNote}>
        Only the listing owner and platform administrators can open these files. Never upload passwords, payment-card details, or unrelated personal records.
      </Text>
    </View>
  );
}

function formatFileSize(bytes: number) {
  if (!bytes) return 'Size unavailable';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  headingCopy: { flex: 1, gap: 3 },
  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.successSoft,
  },
  privateText: { color: Colors.success, fontSize: 10, fontWeight: '900' },
  stateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  stateText: { color: Colors.textMuted, fontSize: FontSize.sm },
  emptyState: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  list: { gap: Spacing.sm },
  documentRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  documentIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySoft,
  },
  documentCopy: { flex: 1, gap: 3 },
  documentName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  documentMeta: { color: Colors.textMuted, fontSize: FontSize.xs },
  removeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.dangerSoft },
  feedbackText: { flex: 1, color: Colors.danger, fontSize: FontSize.xs, lineHeight: 18 },
  uploadButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  uploadText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  privacyNote: { color: Colors.textSubtle, fontSize: FontSize.xs, lineHeight: 18 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
