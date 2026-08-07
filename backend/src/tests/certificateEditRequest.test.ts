import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEditRequestUpdate,
  createEditRequestNotificationMessage,
  parseEditRequestNotificationMessage,
} from '../services/certificateEditRequest';

test('links an edit-request notification and restores its display message', () => {
  const linked = createEditRequestNotificationMessage('Alice requested an edit.', 'request-123');

  assert.deepEqual(parseEditRequestNotificationMessage(linked), {
    message: 'Alice requested an edit.',
    editRequestId: 'request-123',
  });
});

test('leaves ordinary notifications unchanged', () => {
  assert.deepEqual(parseEditRequestNotificationMessage('Certificate uploaded.'), {
    message: 'Certificate uploaded.',
    editRequestId: null,
  });
});

test('accepting an edit request applies proposed fields and marks a valid certificate completed', () => {
  const update = buildEditRequestUpdate({
    completionDate: '2026-08-01',
    expiryDate: '2027-08-01',
    credentialId: 'AZ-900-123',
  }, {});

  assert.equal((update.completionDate as Date).toISOString().slice(0, 10), '2026-08-01');
  assert.equal((update.expiryDate as Date).toISOString().slice(0, 10), '2027-08-01');
  assert.equal(update.credentialId, 'AZ-900-123');
  assert.equal(update.status, 'COMPLETED');
});

test('accepting an expired date marks the certificate expired and can clear a credential ID', () => {
  const update = buildEditRequestUpdate({
    expiryDate: '2020-01-01',
    credentialId: null,
  }, { completionDate: new Date('2019-01-01') });

  assert.equal(update.expiryDate instanceof Date, true);
  assert.equal(update.credentialId, null);
  assert.equal(update.status, 'EXPIRED');
});
