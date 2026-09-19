/**
 * Reglene for hvem som ser og gjør hva blant venner og i grupper. Rene
 * funksjoner uten database, så de kan testes hver for seg og gjenbrukes i
 * hver prosedyre. Databasen leverer fakta; disse funksjonene dømmer.
 */

export type FriendshipRow = { requesterId: number; addresseeId: number | null; status: string };
export type MembershipRow = { customerId: number; role: string; leftAt: Date | null };
export type PostRow = { authorId: number; audience: string; groupId: number | null; hidden: boolean };

/** To kunder er venner når det finnes en godtatt relasjon mellom dem, uansett retning. */
export function areFriends(a: number, b: number, rows: FriendshipRow[]): boolean {
  if (a === b) return true;
  return rows.some((r) => r.status === "accepted" && ((r.requesterId === a && r.addresseeId === b) || (r.requesterId === b && r.addresseeId === a)));
}

export function isBlockedEitherWay(a: number, b: number, blocks: { blockerId: number; blockedId: number }[]): boolean {
  return blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
}

export function activeMember(customerId: number, members: MembershipRow[]): MembershipRow | undefined {
  return members.find((m) => m.customerId === customerId && m.leftAt === null);
}

export function isGroupOwner(customerId: number, members: MembershipRow[]): boolean {
  return activeMember(customerId, members)?.role === "owner";
}

/**
 * Kan `viewer` se innlegget? Skjulte innlegg ser bare forfatteren selv.
 * Gruppeinnlegg: aktive medlemmer. Venneinnlegg: forfatterens venner – og
 * ingen som er blokkert i noen retning.
 */
export function canViewPost(
  viewer: number,
  post: PostRow,
  facts: { friendships: FriendshipRow[]; members: MembershipRow[]; blocks: { blockerId: number; blockedId: number }[] },
): boolean {
  if (post.hidden && post.authorId !== viewer) return false;
  if (post.authorId === viewer) return true;
  if (isBlockedEitherWay(viewer, post.authorId, facts.blocks)) return false;
  if (post.audience === "group") return post.groupId !== null && Boolean(activeMember(viewer, facts.members));
  return areFriends(viewer, post.authorId, facts.friendships);
}

/** Fjerne innlegg: forfatteren selv, eller gruppens eier når innlegget står i gruppen. */
export function canRemovePost(actor: number, post: PostRow, members: MembershipRow[]): boolean {
  if (post.authorId === actor) return true;
  return post.audience === "group" && isGroupOwner(actor, members);
}

/** Eieren kan ikke forlate gruppen uten å overføre den – da ville gruppen stå uten noen som kan rydde. */
export function canLeaveGroup(customerId: number, members: MembershipRow[]): { ok: true } | { ok: false; reason: "not_member" | "owner" } {
  const me = activeMember(customerId, members);
  if (!me) return { ok: false, reason: "not_member" };
  if (me.role === "owner") return { ok: false, reason: "owner" };
  return { ok: true };
}

export function canRemoveMember(actor: number, target: number, members: MembershipRow[]): boolean {
  if (actor === target) return false;
  return isGroupOwner(actor, members) && Boolean(activeMember(target, members)) && !isGroupOwner(target, members);
}

/** Første bokstav i etternavnet – vi viser aldri hele etternavn til andre kunder. */
export function displayName(firstName: string, lastName: string): string {
  const last = lastName.trim();
  return last ? `${firstName.trim()} ${last[0]!.toUpperCase()}.` : firstName.trim();
}
