import type { DocumentPickerAsset } from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import type { VerificationDocument, VerificationRequest } from '@/lib/types';

export const VERIFICATION_DOCUMENT_BUCKET = 'provider-verification';
export const MAX_VERIFICATION_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_VERIFICATION_DOCUMENTS = 5;

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

type StorageListItem = {
  id: string | null;
  name: string;
  created_at: string | null;
  metadata: { size?: number; mimetype?: string } | null;
};

type DocumentResult<T = undefined> = { data?: T; error: string | null };

export async function listVerificationDocuments(
  request: VerificationRequest
): Promise<DocumentResult<VerificationDocument[]>> {
  const prefix = verificationDocumentPrefix(request.providerOwnerId, request.id);
  const { data, error } = await supabase.storage
    .from(VERIFICATION_DOCUMENT_BUCKET)
    .list(prefix, { limit: MAX_VERIFICATION_DOCUMENTS, sortBy: { column: 'created_at', order: 'asc' } });

  if (error) return { error: error.message };
  const documents = ((data ?? []) as StorageListItem[])
    .filter((item) => Boolean(item.id))
    .map((item) => ({
      id: item.id as string,
      path: `${prefix}/${item.name}`,
      name: displayNameFromObjectName(item.name),
      size: Number(item.metadata?.size ?? 0),
      mimeType: String(item.metadata?.mimetype ?? ''),
      createdAt: item.created_at ?? new Date(0).toISOString(),
    }));

  return { data: documents, error: null };
}

export async function uploadVerificationDocument(
  request: VerificationRequest,
  asset: DocumentPickerAsset
): Promise<DocumentResult<VerificationDocument>> {
  const validationError = validateAsset(asset);
  if (validationError) return { error: validationError };

  const contentType = normalizeMimeType(asset);
  if (!contentType) return { error: 'Only PDF, JPEG, and PNG documents are accepted.' };
  const objectName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${sanitizeFileName(asset.name)}`;
  const path = `${verificationDocumentPrefix(request.providerOwnerId, request.id)}/${objectName}`;

  try {
    const body = asset.file
      ? await asset.file.arrayBuffer()
      : await new ExpoFile(asset.uri).arrayBuffer();
    const { data, error } = await supabase.storage
      .from(VERIFICATION_DOCUMENT_BUCKET)
      .upload(path, body, { contentType, upsert: false });

    if (error) return { error: error.message };
    return {
      data: {
        id: data.id,
        path: data.path,
        name: asset.name,
        size: asset.size ?? body.byteLength,
        mimeType: contentType,
        createdAt: new Date().toISOString(),
      },
      error: null,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The selected file could not be read.' };
  }
}

export async function removeVerificationDocument(path: string): Promise<DocumentResult> {
  const { error } = await supabase.storage.from(VERIFICATION_DOCUMENT_BUCKET).remove([path]);
  return { error: error?.message ?? null };
}

export async function removeAllVerificationDocuments(
  request: VerificationRequest
): Promise<DocumentResult> {
  const listed = await listVerificationDocuments(request);
  if (listed.error) return { error: listed.error };
  const paths = (listed.data ?? []).map((document) => document.path);
  if (!paths.length) return { error: null };
  const { error } = await supabase.storage.from(VERIFICATION_DOCUMENT_BUCKET).remove(paths);
  return { error: error?.message ?? null };
}

export async function createVerificationDocumentUrl(
  document: VerificationDocument
): Promise<DocumentResult<string>> {
  const { data, error } = await supabase.storage
    .from(VERIFICATION_DOCUMENT_BUCKET)
    .createSignedUrl(document.path, 60, { download: document.name });
  return { data: data?.signedUrl, error: error?.message ?? null };
}

function verificationDocumentPrefix(ownerId: string, requestId: string) {
  return `${ownerId}/${requestId}`;
}

function normalizeMimeType(asset: DocumentPickerAsset) {
  if (asset.mimeType && ALLOWED_MIME_TYPES.has(asset.mimeType.toLowerCase())) {
    return asset.mimeType.toLowerCase();
  }
  const extension = fileExtension(asset.name);
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return null;
}

function validateAsset(asset: DocumentPickerAsset) {
  if (asset.size != null && asset.size > MAX_VERIFICATION_DOCUMENT_BYTES) {
    return 'Choose a file smaller than 5 MB.';
  }
  const mimeType = normalizeMimeType(asset);
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return 'Only PDF, JPEG, and PNG documents are accepted.';
  }
  return null;
}

function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function sanitizeFileName(name: string) {
  const sanitized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120);
  return sanitized || `verification-document.${fileExtension(name) || 'pdf'}`;
}

function displayNameFromObjectName(name: string) {
  return name.replace(/^\d+-[a-z0-9]+-/, '') || 'Verification document';
}
