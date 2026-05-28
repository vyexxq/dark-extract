import type { PartyState, PlayerId } from "@dark-extract/shared";

export interface Party {
  id: string;
  leaderId: PlayerId;
  memberIds: PlayerId[];
  ready: Set<PlayerId>;
}

const parties = new Map<string, Party>();
const playerParty = new Map<PlayerId, string>();

export function getPartyForPlayer(playerId: PlayerId): Party | undefined {
  const pid = playerParty.get(playerId);
  if (!pid) return undefined;
  return parties.get(pid);
}

export function getPartyState(
  party: Party,
  names: Map<PlayerId, string>,
): PartyState {
  return {
    partyId: party.id,
    leaderId: party.leaderId,
    members: party.memberIds.map((id) => ({
      playerId: id,
      name: names.get(id) ?? "?",
      ready: party.ready.has(id),
      isLeader: id === party.leaderId,
    })),
  };
}

export function createParty(leaderId: PlayerId): Party {
  leaveParty(leaderId);
  const party: Party = {
    id: crypto.randomUUID(),
    leaderId,
    memberIds: [leaderId],
    ready: new Set(),
  };
  parties.set(party.id, party);
  playerParty.set(leaderId, party.id);
  return party;
}

export function inviteToParty(party: Party, targetId: PlayerId): boolean {
  if (party.memberIds.length >= 3) return false;
  if (party.memberIds.includes(targetId)) return false;
  leaveParty(targetId);
  party.memberIds.push(targetId);
  party.ready.delete(targetId);
  playerParty.set(targetId, party.id);
  return true;
}

export function leaveParty(playerId: PlayerId): void {
  const pid = playerParty.get(playerId);
  if (!pid) return;
  const party = parties.get(pid);
  playerParty.delete(playerId);
  if (!party) return;

  party.memberIds = party.memberIds.filter((id) => id !== playerId);
  party.ready.delete(playerId);

  if (party.memberIds.length === 0) {
    parties.delete(pid);
    return;
  }

  if (party.leaderId === playerId) {
    party.leaderId = party.memberIds[0]!;
  }
}

export function setReady(party: Party, playerId: PlayerId, ready: boolean): void {
  if (!party.memberIds.includes(playerId)) return;
  if (ready) party.ready.add(playerId);
  else party.ready.delete(playerId);
}

export function partyAllReady(party: Party): boolean {
  return party.memberIds.length >= 1 && party.memberIds.every((id) => party.ready.has(id));
}

export function dissolveParty(partyId: string): void {
  const party = parties.get(partyId);
  if (!party) return;
  for (const id of party.memberIds) {
    playerParty.delete(id);
  }
  parties.delete(partyId);
}
