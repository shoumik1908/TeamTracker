import { describe, expect, it } from 'vitest';
import { formatMessage } from './ChatBot';

// TT-067: formatMessage feeds dangerouslySetInnerHTML for every chat message — the
// user's own text and the assistant's reply alike. It did no escaping, and the
// assistant has live access to team data, so a member or project whose name contains
// markup became script execution in whoever's browser the bot mentioned it to.
describe('chat message formatting', () => {
  it('escapes an image-onerror payload instead of rendering it', () => {
    const out = formatMessage('<img src=x onerror="alert(1)">');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('escapes a script tag', () => {
    const out = formatMessage('<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapes markup arriving inside an assistant reply about a member', () => {
    // The realistic path: the member's *name* is the payload.
    const out = formatMessage('Overdue: <img src=x onerror=fetch("//evil")> has 2 certs');
    // The words "onerror=" survive as escaped text, which is inert — what matters is
    // that no tag and no attribute quote reach the DOM as markup.
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(out).toContain('&quot;//evil&quot;');
    // The only tags in the output are ones formatMessage itself introduces.
    const tags = out.match(/<[^>]+>/g) ?? [];
    expect(tags.every(t => /^<\/?(strong|em|br\/?)>$/.test(t))).toBe(true);
  });

  it('neutralises an attribute-breaking quote', () => {
    expect(formatMessage('" onmouseover="alert(1)')).not.toContain('onmouseover="alert(1)"');
  });

  it('still renders bold, italic and line breaks', () => {
    expect(formatMessage('**bold**')).toContain('<strong>bold</strong>');
    expect(formatMessage('*soft*')).toContain('<em>soft</em>');
    expect(formatMessage('one\ntwo')).toContain('<br/>');
    expect(formatMessage('• item')).toContain('&bull;');
  });

  it('leaves ordinary prose untouched apart from the markdown it means to convert', () => {
    expect(formatMessage('Alice has 3 overdue certifications.'))
      .toBe('Alice has 3 overdue certifications.');
  });

  it('does not double-escape an ampersand into visible mojibake', () => {
    // &amp; must appear once, not as &amp;amp;
    expect(formatMessage('R&D team')).toBe('R&amp;D team');
  });
});
