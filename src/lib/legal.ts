import documents from './legal-documents.json';

export const legalOperator = process.env.EXPO_PUBLIC_LEGAL_OPERATOR?.trim() || '';
export const legalEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || '';
const backups = process.env.EXPO_PUBLIC_BACKUP_RETENTION?.trim() || '';
const logs = process.env.EXPO_PUBLIC_LOG_RETENTION?.trim() || '';
export const legalConfigured = Boolean(legalOperator && legalEmail && backups && logs);
export type LegalDocument = 'privacy' | 'terms' | 'deletion';

export function getLegalDocument(key: LegalDocument) {
  const document = documents[key];
  return { ...document, version: documents.version,
    sections: document.sections.map(section => ({ ...section,
      body: section.body.replaceAll('{{operator}}', legalOperator || 'the BeyBridge operator (details pending)')
        .replaceAll('{{email}}', legalEmail || 'the support contact (details pending)')
        .replaceAll('{{backups}}', backups || 'period pending confirmation')
        .replaceAll('{{logs}}', logs || 'period pending confirmation') })) };
}
