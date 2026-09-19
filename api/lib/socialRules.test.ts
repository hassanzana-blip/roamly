import { describe, expect, it } from "vitest";
import { areFriends, canLeaveGroup, canRemoveMember, canRemovePost, canViewPost, displayName } from "./socialRules";

const friends = [{ requesterId: 1, addresseeId: 2, status: "accepted" }, { requesterId: 3, addresseeId: 1, status: "pending" }];
const members = [
  { customerId: 1, role: "owner", leftAt: null },
  { customerId: 2, role: "member", leftAt: null },
  { customerId: 4, role: "member", leftAt: new Date() },
];
const facts = { friendships: friends, members, blocks: [] as { blockerId: number; blockedId: number }[] };

describe("venner", () => {
  it("er venner bare når relasjonen er godtatt, i begge retninger", () => {
    expect(areFriends(1, 2, friends)).toBe(true);
    expect(areFriends(2, 1, friends)).toBe(true);
    expect(areFriends(1, 3, friends)).toBe(false);
    expect(areFriends(1, 1, friends)).toBe(true);
  });
});

describe("canViewPost", () => {
  const friendsPost = { authorId: 1, audience: "friends", groupId: null, hidden: false };
  const groupPost = { authorId: 1, audience: "group", groupId: 10, hidden: false };
  it("venneinnlegg ses av venner, ikke av fremmede eller blokkerte", () => {
    expect(canViewPost(2, friendsPost, facts)).toBe(true);
    expect(canViewPost(3, friendsPost, facts)).toBe(false);
    expect(canViewPost(2, friendsPost, { ...facts, blocks: [{ blockerId: 1, blockedId: 2 }] })).toBe(false);
    expect(canViewPost(2, friendsPost, { ...facts, blocks: [{ blockerId: 2, blockedId: 1 }] })).toBe(false);
  });
  it("gruppeinnlegg ses av aktive medlemmer – ikke av dem som har forlatt gruppen", () => {
    expect(canViewPost(2, groupPost, facts)).toBe(true);
    expect(canViewPost(4, groupPost, facts)).toBe(false);
    expect(canViewPost(3, groupPost, facts)).toBe(false);
  });
  it("skjulte innlegg ser bare forfatteren", () => {
    expect(canViewPost(2, { ...friendsPost, hidden: true }, facts)).toBe(false);
    expect(canViewPost(1, { ...friendsPost, hidden: true }, facts)).toBe(true);
  });
});

describe("grupper", () => {
  it("eieren kan fjerne andres gruppeinnlegg, men ikke venneinnlegg", () => {
    expect(canRemovePost(1, { authorId: 2, audience: "group", groupId: 10, hidden: false }, members)).toBe(true);
    expect(canRemovePost(1, { authorId: 2, audience: "friends", groupId: null, hidden: false }, members)).toBe(false);
    expect(canRemovePost(2, { authorId: 2, audience: "friends", groupId: null, hidden: false }, members)).toBe(true);
  });
  it("medlemmer kan forlate, eieren kan ikke, ikke-medlemmer er ikke med", () => {
    expect(canLeaveGroup(2, members)).toEqual({ ok: true });
    expect(canLeaveGroup(1, members)).toEqual({ ok: false, reason: "owner" });
    expect(canLeaveGroup(4, members)).toEqual({ ok: false, reason: "not_member" });
  });
  it("bare eieren fjerner medlemmer, aldri seg selv eller en annen eier", () => {
    expect(canRemoveMember(1, 2, members)).toBe(true);
    expect(canRemoveMember(2, 1, members)).toBe(false);
    expect(canRemoveMember(1, 1, members)).toBe(false);
    expect(canRemoveMember(1, 4, members)).toBe(false);
  });
});

describe("displayName", () => {
  it("viser fornavn og første bokstav i etternavnet", () => {
    expect(displayName("Emma", "Hansen")).toBe("Emma H.");
    expect(displayName("Emma", "")).toBe("Emma");
  });
});
