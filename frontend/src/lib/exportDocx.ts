import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { extractMeetingDate } from './utils';

export async function generateMeetingDocx(record: any, aiMinutes: any, actionItems: any[] = []) {
  if (!aiMinutes) return;

  const meetingTitle = aiMinutes.meeting_title || record.meetingTitle || 'Meeting Summary';
  const meetingDate = aiMinutes.meeting_date || (record.meetingDate ? extractMeetingDate(record.meetingDate) : 'Unknown Date');
  const duration = aiMinutes.duration_estimate || 'N/A';
  const ledBy = aiMinutes.led_by || 'N/A';
  const facilitator = aiMinutes.facilitated_by;
  const attendeesPresent = aiMinutes.attendees_present || aiMinutes.attendees || aiMinutes.attendees_mentioned || [];
  const attendeesNotPresent = aiMinutes.attendees_referenced_not_present || [];

  const children: any[] = [
    new Paragraph({
      text: meetingTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    
    // Metadata block
    new Paragraph({
      children: [
        new TextRun({ text: 'Meeting Date: ', bold: true }),
        new TextRun(meetingDate),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Duration: ', bold: true }),
        new TextRun(duration),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Led By: ', bold: true }),
        new TextRun(ledBy),
      ],
    }),
  ];

  if (facilitator) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Facilitator: ', bold: true }),
          new TextRun(facilitator),
        ],
      })
    );
  }

  if (attendeesPresent.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Attendees Present: ', bold: true }),
          new TextRun(attendeesPresent.join(', ')),
        ],
      })
    );
  }

  if (attendeesNotPresent.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Not Present (Mentioned): ', bold: true }),
          new TextRun(attendeesNotPresent.join(', ')),
        ],
      })
    );
  }

  children.push(new Paragraph({ text: '', spacing: { before: 200 } }));

  // Helper to append a section if content exists
  const appendSection = (title: string, contentArray: string[] | null) => {
    if (contentArray && contentArray.length > 0) {
      children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
      for (const item of contentArray) {
        children.push(
          new Paragraph({
            text: item,
            bullet: { level: 0 }
          })
        );
      }
    }
  };

  const appendTextSection = (title: string, content: string | null) => {
    if (content) {
      children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
      
      // Split into paragraphs by double newline, then handle bullet points
      const parts = content.split('\n\n');
      for (const part of parts) {
        if (part.trim().startsWith('-') || part.trim().startsWith('*')) {
          const items = part.split('\n').map(l => l.replace(/^[\s-*]+/, '').trim()).filter(Boolean);
          for (const item of items) {
            children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
          }
        } else {
          children.push(new Paragraph({ text: part.trim() }));
        }
      }
    }
  };

  // 1. Quick Summary (New Schema)
  appendTextSection('Quick Summary', aiMinutes.quick_summary);

  // 2. Meeting Purpose
  appendTextSection('Meeting Purpose', aiMinutes.purpose);

  // 3. Discussion Points
  appendSection('Discussion Points', aiMinutes.discussion_points);

  // 4. Next Steps
  appendTextSection('Next Steps', aiMinutes.next_steps);

  // 5. Key Decisions
  if (aiMinutes.decisions && aiMinutes.decisions.length > 0) {
    children.push(new Paragraph({ text: 'Key Decisions', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    for (const d of aiMinutes.decisions) {
      const text = typeof d === 'string' ? d : (d.decision || d.decision_text || '');
      children.push(new Paragraph({ text, bullet: { level: 0 } }));
    }
  }

  // 6. Open Risks & Blockers
  const risks = aiMinutes.open_risks_blockers || aiMinutes.blockers_or_risks || [];
  if (risks.length > 0) {
    children.push(new Paragraph({ text: 'Open Risks & Blockers', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    for (const r of risks) {
      const text = typeof r === 'string' ? r : (r.description || '');
      children.push(new Paragraph({ text, bullet: { level: 0 } }));
    }
  }

  // 7. Action Items (From state, overriding aiMinutes to ensure sync with UI interactions like 'completed')
  if (actionItems && actionItems.length > 0) {
    children.push(new Paragraph({ text: 'Action Items', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    for (const a of actionItems) {
      const owner = a.assignedTo?.name || a.originalOwnerText || 'Unassigned';
      const statusText = a.completed ? ' (Completed)' : '';
      children.push(new Paragraph({ text: a.task + ' - ' + owner + statusText, bullet: { level: 0 } }));
    }
  } else if (aiMinutes.action_items && aiMinutes.action_items.length > 0) {
    children.push(new Paragraph({ text: 'Action Items', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    for (const a of aiMinutes.action_items) {
      const owner = a.owner || 'Unassigned';
      const conf = (a.confidence && a.confidence !== 'High') ? ' [' + a.confidence + ' Confidence]' : '';
      const statusText = (a.status && a.status.toLowerCase() === 'completed') ? ' (Completed)' : '';
      children.push(new Paragraph({ text: a.task + ' - ' + owner + conf + statusText, bullet: { level: 0 } }));
    }
  }

  // 8. Progress Updates
  if (aiMinutes.progress_updates && aiMinutes.progress_updates.length > 0) {
    children.push(new Paragraph({ text: 'Progress Updates', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    for (const p of aiMinutes.progress_updates) {
      children.push(new Paragraph({ text: p.topic + ': ' + p.exact_value, bullet: { level: 0 } }));
    }
  }

  // 9. Legacy Fields
  appendTextSection('Meeting Summary', aiMinutes.meeting_summary);
  appendSection('Agenda Topics', aiMinutes.agenda_topics);
  appendSection('Open Questions', aiMinutes.open_questions);

  // Footer
  const dateStr = new Date().toISOString().split('T')[0];
  children.push(
    new Paragraph({
      text: 'Generated on ' + dateStr,
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 }
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const safeTitle = encodeURIComponent(meetingTitle.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').substring(0, 50));
  const safeDate = meetingDate.replace(/[^0-9-]/g, '');
  const shortHash = record.id ? record.id.slice(-6) : 'record';
  const filename = safeTitle + '_' + safeDate + '_' + shortHash + '.docx';

  // Trigger download
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}


function fmtDisplay(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch(e) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

export async function generateReportDocx(
  reportData: any,
  projectName: string,
  _periodLabel: string,
  period: { start: string; end: string },
  windowType: string
) {
  const children: any[] = [
    new Paragraph({
      text: projectName + ' — Meeting Report',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: (windowType.charAt(0).toUpperCase() + windowType.slice(1)) + ': ' + fmtDisplay(period.start) + ' – ' + fmtDisplay(period.end), bold: true }),
        new TextRun(' · ' + reportData.meetings.length + ' meeting' + (reportData.meetings.length !== 1 ? 's' : '') + ' included'),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
  ];

  if (reportData.meetings.length === 0) {
    children.push(new Paragraph({
      text: 'No meetings found between ' + fmtDisplay(period.start) + ' and ' + fmtDisplay(period.end),
      alignment: AlignmentType.CENTER
    }));
  } else {
    // 1. EXECUTIVE SUMMARY
    if (reportData.executiveSummary) {
      children.push(new Paragraph({ text: `PROGRESS UPDATE (${fmtDisplay(period.start)} - ${fmtDisplay(period.end)})`, heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } }));
      children.push(new Paragraph({ text: reportData.executiveSummary, spacing: { before: 100, after: 300 } }));
    }

    // 2. MEETINGS COVERED
    children.push(new Paragraph({ text: 'MEETINGS COVERED', heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } }));
    for (let i = 0; i < reportData.meetings.length; i++) {
      const m = reportData.meetings[i];
      const displayDate = m.aiMinutes?.meeting_date || fmtDisplay(m.meetingDate);
      children.push(new Paragraph({ text: `${i + 1}. ${m.meetingTitle} — ${displayDate}` }));
    }

    children.push(new Paragraph({ text: 'PER-MEETING BREAKDOWN', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    
    for (const m of reportData.meetings) {
      const am = m.aiMinutes;
      if (!am) continue;
      const displayDate = am.meeting_date || fmtDisplay(m.meetingDate);
      
      const hasDecisions = am.decisions && am.decisions.length > 0;
      const hasProgress = am.progress_updates && am.progress_updates.length > 0;
      const hasActions = am.action_items && am.action_items.length > 0;
      const hasRisks = am.open_risks_blockers && am.open_risks_blockers.length > 0;

      if (!hasDecisions && !hasProgress && !hasActions && !hasRisks && !am.quick_summary && !am.purpose) continue;

      children.push(new Paragraph({ text: `${displayDate} — ${m.meetingTitle}`, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));

      if (am.quick_summary) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Meeting Summary', bold: true })], spacing: { before: 100 } }));
        children.push(new Paragraph({ text: am.quick_summary, spacing: { after: 100 } }));
      }

      if (am.purpose) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Agenda / Purpose', bold: true })], spacing: { before: 100 } }));
        children.push(new Paragraph({ text: am.purpose, spacing: { after: 100 } }));
      }

      if (hasDecisions) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Key Decisions', bold: true })], spacing: { before: 100 } }));
        for (const d of am.decisions) {
          const conf = d.confidence !== 'High' ? ` [${d.confidence}]` : '';
          children.push(new Paragraph({ text: d.decision + conf, bullet: { level: 0 } }));
        }
      }

      if (hasProgress) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Progress Updates', bold: true })], spacing: { before: 100 } }));
        for (const p of am.progress_updates) {
          const conf = p.confidence !== 'High' ? ` [${p.confidence}]` : '';
          children.push(new Paragraph({ text: p.exact_value + conf, bullet: { level: 0 } }));
        }
      }

      if (hasActions) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Action Items', bold: true })], spacing: { before: 100 } }));
        for (const a of am.action_items) {
          const owner = a.owner || 'Unassigned';
          const conf = a.confidence !== 'High' ? ` [${a.confidence}]` : '';
          children.push(new Paragraph({ text: `${a.task} — ${owner}${conf}`, bullet: { level: 0 } }));
        }
      }

      if (hasRisks) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Risks / Blockers', bold: true })], spacing: { before: 100 } }));
        for (const r of am.open_risks_blockers) {
          const conf = r.confidence !== 'High' ? ` [${r.confidence}]` : '';
          children.push(new Paragraph({ text: r.description + conf, bullet: { level: 0 } }));
        }
      }
    }

    const allDecisions: any[] = [];
    const openActionsByOwner: Record<string, any[]> = {};
    const allRisks: any[] = [];
    
    reportData.meetings.forEach((m: any) => {
      const am = m.aiMinutes;
      if (!am) return;
      const displayDate = am.meeting_date || fmtDisplay(m.meetingDate);

      if (am.decisions?.length) {
        am.decisions.forEach((d: any) => { allDecisions.push({ ...d, meetingDisplayDate: displayDate }); });
      }
      if (am.action_items?.length) {
        am.action_items.forEach((a: any) => {
          if (a.status === 'Open') {
            const owner = a.owner || 'Unassigned';
            if (!openActionsByOwner[owner]) openActionsByOwner[owner] = [];
            openActionsByOwner[owner].push({ ...a, meetingDisplayDate: displayDate });
          }
        });
      }
      if (am.open_risks_blockers?.length) {
        am.open_risks_blockers.forEach((r: any) => { allRisks.push({ ...r, meetingDisplayDate: displayDate }); });
      }
    });

    if (allDecisions.length > 0 || Object.keys(openActionsByOwner).length > 0 || allRisks.length > 0) {
      children.push(new Paragraph({ text: 'CONSOLIDATED ROLLUP', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));

      if (allDecisions.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'All Decisions This Period', bold: true })], spacing: { before: 100 } }));
        for (const d of allDecisions) {
          const conf = d.confidence !== 'High' ? ` [${d.confidence}]` : '';
          children.push(new Paragraph({
            children: [
              new TextRun(d.decision + conf)
            ],
            bullet: { level: 0 }
          }));
        }
      }

      if (Object.keys(openActionsByOwner).length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Outstanding Action Items', bold: true })], spacing: { before: 200 } }));
        for (const [owner, items] of Object.entries(openActionsByOwner)) {
          children.push(new Paragraph({ children: [new TextRun({ text: owner, bold: true })], spacing: { before: 100 } }));
          for (const a of (items as any[])) {
            const conf = a.confidence !== 'High' ? ` [${a.confidence}]` : '';
            children.push(new Paragraph({
              children: [
                new TextRun(a.task + conf)
              ],
              bullet: { level: 0 }
            }));
          }
        }
      }

      if (allRisks.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Risks / Blockers Raised This Period', bold: true })], spacing: { before: 200 } }));
        for (const r of allRisks) {
          const conf = r.confidence !== 'High' ? ` [${r.confidence}]` : '';
          children.push(new Paragraph({
            children: [
              new TextRun(r.description + conf)
            ],
            bullet: { level: 0 }
          }));
        }
      }
    }
  }

  const reportGenTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST';
  children.push(new Paragraph({
    text: 'Generated on ' + reportGenTime + '\nGenerated from ' + reportData.meetings.length + ' meeting transcript' + (reportData.meetings.length !== 1 ? 's' : '') + ' between ' + fmtDisplay(period.start) + ' and ' + fmtDisplay(period.end) + '\nThis report reflects AI-generated meeting minutes only and has not been independently verified. Items marked with a confidence tag should be manually confirmed against the source meeting.',
    alignment: AlignmentType.CENTER,
    spacing: { before: 600 }
  }));

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const safeProject = projectName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').substring(0, 40);
  const filename = safeProject + '_Meeting-Report_' + period.start + '_to_' + period.end + '.docx';

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}
