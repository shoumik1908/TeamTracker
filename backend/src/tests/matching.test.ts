import assert from 'node:assert/strict';
import test from 'node:test';
import { matchCertificateTitle } from '../services/certMatcher';
import { correctNamesInTranscript, matchTeamMember } from '../utils/fuzzyMatch';

const catalog = [
  { id: 'aws-associate', name: 'AWS Certified Solutions Architect Associate', provider: 'AWS' },
  { id: 'aws-professional', name: 'AWS Certified Solutions Architect Professional', provider: 'AWS' },
];

test('matches an exact certificate title to the catalog entry', () => {
  const result = matchCertificateTitle(['AWS Certified Solutions Architect Associate'], catalog);

  assert.equal(result.bestMatch?.id, 'aws-associate');
  assert.equal(result.confidence, 100);
});

test('does not auto-select a certification when the tier is different', () => {
  const result = matchCertificateTitle(['AWS Certified Solutions Architect Expert'], catalog);

  assert.equal(result.bestMatch, null);
});

test('matches a certificate recipient to the correct team member', () => {
  const result = matchTeamMember('Alice Johnson', [
    { id: 'alice', name: 'Alice Johnson' },
    { id: 'bob', name: 'Bob Smith' },
  ]);

  assert.deepEqual(result, {
    matches: true,
    score: 100,
    extractedName: 'Alice Johnson',
    memberId: 'alice',
    memberName: 'Alice Johnson',
  });
});

test('does not match a clearly unrelated certificate recipient', () => {
  const result = matchTeamMember('Zxqv Rtlm', [{ id: 'alice', name: 'Alice Johnson' }]);

  assert.equal(result.matches, false);
  assert.equal(result.memberId, null);
});

test('corrects likely member-name misspellings in meeting transcripts', () => {
  const result = correctNamesInTranscript('Alic Jonson will send the update.', [
    { id: 'alice', name: 'Alice Johnson' },
  ]);

  assert.equal(result.correctedText, 'Alice Johnson will send the update.');
  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0].corrected, 'Alice Johnson');
});
