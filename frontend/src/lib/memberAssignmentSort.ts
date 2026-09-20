type AssignableMember = {
  id: string;
  name: string;
  allocationStatus?: string | null;
};

type ExistingAssignment = { member: { id: string } };

/**
 * Orders the member picker used by the project and pre-sales assign panels: members who
 * are already assigned sink to the bottom, members you have just ticked rise to the top,
 * then benched before allocated, then by name.
 *
 * This was duplicated verbatim in both 1900-line pages and did `filtered.sort(...)`, where
 * `filtered` IS the array React Query handed back whenever the search box is empty — so
 * rendering either page sorted the shared ['members'] cache in place and every other
 * consumer of that query silently received reordered data with no re-render to tell it.
 * Copying first keeps the sort local; living in one tested module keeps it that way.
 */
export function sortMembersForAssignment<T extends AssignableMember>(
  allMembers: T[],
  searchQuery: string,
  assignedMembers: ExistingAssignment[],
  selectedToAssign: Set<string> = new Set(),
): T[] {
  let filtered = allMembers;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(m => m.name.toLowerCase().includes(q));
  }

  return [...filtered].sort((a, b) => {
    const aAssigned = assignedMembers.some(am => am.member.id === a.id);
    const bAssigned = assignedMembers.some(am => am.member.id === b.id);
    if (aAssigned && !bAssigned) return 1;
    if (!aAssigned && bAssigned) return -1;

    const aSel = selectedToAssign.has(a.id);
    const bSel = selectedToAssign.has(b.id);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;

    const aBenched = a.allocationStatus === 'BENCHED';
    const bBenched = b.allocationStatus === 'BENCHED';
    if (aBenched && !bBenched) return -1;
    if (!aBenched && bBenched) return 1;

    const aAllocated = a.allocationStatus === 'ALLOCATED';
    const bAllocated = b.allocationStatus === 'ALLOCATED';
    if (aAllocated && !bAllocated) return -1;
    if (!aAllocated && bAllocated) return 1;

    return a.name.localeCompare(b.name);
  });
}
