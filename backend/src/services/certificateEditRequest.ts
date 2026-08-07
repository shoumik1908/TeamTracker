export type CertificateEditChanges = {
  completionDate?: string | null;
  expiryDate?: string | null;
  credentialId?: string | null;
};

type ExistingAssignmentDates = {
  completionDate?: Date | null;
  expiryDate?: Date | null;
};

const EDIT_REQUEST_MARKER = /\n\[edit-request:([^\]]+)\]$/;

export function createEditRequestNotificationMessage(message: string, editRequestId: string) {
  return `${message}\n[edit-request:${editRequestId}]`;
}

export function parseEditRequestNotificationMessage(message: string) {
  const match = message.match(EDIT_REQUEST_MARKER);
  return {
    message: message.replace(EDIT_REQUEST_MARKER, ''),
    editRequestId: match?.[1] || null,
  };
}

export function buildEditRequestUpdate(
  changes: CertificateEditChanges,
  existing: ExistingAssignmentDates,
) {
  const updateData: Record<string, unknown> = {};

  if (changes.completionDate) updateData.completionDate = new Date(changes.completionDate);
  if (changes.expiryDate !== undefined) {
    updateData.expiryDate = changes.expiryDate ? new Date(changes.expiryDate) : null;
  }
  if (changes.credentialId !== undefined) updateData.credentialId = changes.credentialId;

  if (updateData.completionDate || updateData.expiryDate !== undefined) {
    const completionDate = (updateData.completionDate as Date | undefined) || existing.completionDate;
    const expiryDate = updateData.expiryDate !== undefined
      ? updateData.expiryDate as Date | null
      : existing.expiryDate;

    if (completionDate) {
      updateData.status = expiryDate && expiryDate < new Date() ? 'EXPIRED' : 'COMPLETED';
    }
  }

  return updateData;
}
