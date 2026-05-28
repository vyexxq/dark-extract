import { isNearHubContracts, type PartyState, type PlayerId } from "@dark-extract/shared";
import type { HubClient } from "./hubTypes.js";

export interface Party {
  id: string;
  leaderId: PlayerId;
  memberIds: PlayerId[];
  ready: Set<PlayerId>;
}

export interface PendingInvite {
  id: string;
  partyId: string;
  fromId: PlayerId;
  toId: PlayerId;
  createdAt: number;
}

const parties = new Map<string, Party>();
const playerParty = new Map<PlayerId, string>();
const pendingInvites = new Map<string, PendingInvite>();
const invitesForPlayer = new Map<PlayerId, Set<string>>();

const INVITE_TTL_MS = 60_000;

function pruneInvites(): void {
  const now = Date.now();
  for (const [id, inv] of pendingInvites) {
    if (now - inv.createdAt > INVITE_TTL_MS) {
      pendingInvites.delete(id);
      invitesForPlayer.get(inv.toId)?.delete(id);
    }
  }
}

export function getPartyForPlayer(playerId: PlayerId): Party | undefined {
  const pid = playerParty.get(playerId);
  if (!pid) return undefined;
  return parties.get(pid);
}

export function getPartyById(partyId: string): Party | undefined {
  return parties.get(partyId);
}

export function getPartyState(
  party: Party,
  clients: Map<PlayerId, HubClient>,
): PartyState {
  return {
    partyId: party.id,
    leaderId: party.leaderId,
    members: party.memberIds.map((id) => {
      const c = clients.get(id);
      return {
        playerId: id,
        name: c?.state.name ?? "?",
        ready: party.ready.has(id),
        isLeader: id === party.leaderId,
        atContract: c ? isNearHubContracts(c.state.x, c.state.y) : false,
      };
    }),
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

export function createInvite(
  party: Party,
  fromId: PlayerId,
  toId: PlayerId,
): PendingInvite | null {
  pruneInvites();
  if (party.memberIds.length >= 3) return null;
  if (party.memberIds.includes(toId)) return null;
  if (getPartyForPlayer(toId)) return null;

  for (const inv of pendingInvites.values()) {
    if (inv.toId === toId && inv.partyId === party.id) return null;
  }

  const invite: PendingInvite = {
    id: crypto.randomUUID(),
    partyId: party.id,
    fromId,
    toId,
    createdAt: Date.now(),
  };
  pendingInvites.set(invite.id, invite);
  if (!invitesForPlayer.has(toId)) invitesForPlayer.set(toId, new Set());
  invitesForPlayer.get(toId)!.add(invite.id);
  return invite;
}

export function getInvite(inviteId: string): PendingInvite | undefined {
  pruneInvites();
  return pendingInvites.get(inviteId);
}

export function acceptInvite(
  inviteId: string,
  playerId: PlayerId,
): { party: Party; invite: PendingInvite } | null {
  const invite = getInvite(inviteId);
  if (!invite || invite.toId !== playerId) return null;
  const party = parties.get(invite.partyId);
  if (!party) {
    pendingInvites.delete(inviteId);
    return null;
  }
  if (party.memberIds.length >= 3) return null;

  leaveParty(playerId);
  party.memberIds.push(playerId);
  party.ready.delete(playerId);
  playerParty.set(playerId, party.id);
  pendingInvites.delete(inviteId);
  invitesForPlayer.get(playerId)?.delete(inviteId);
  return { party, invite };
}

export function declineInvite(inviteId: string, playerId: PlayerId): PendingInvite | null {
  const invite = getInvite(inviteId);
  if (!invite || invite.toId !== playerId) return null;
  pendingInvites.delete(inviteId);
  invitesForPlayer.get(playerId)?.delete(inviteId);
  return invite;
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

export function setReady(
  party: Party,
  playerId: PlayerId,
  ready: boolean,
  client: HubClient,
): string | null {
  if (!party.memberIds.includes(playerId)) return "Not in party";
  if (ready && !isNearHubContracts(client.state.x, client.state.y)) {
    return "Stand at the Contracts board to ready up";
  }
  if (ready) party.ready.add(playerId);
  else party.ready.delete(playerId);
  return null;
}

export function partyAllReady(party: Party): boolean {
  return party.memberIds.length >= 2 && party.memberIds.every((id) => party.ready.has(id));
}

export function allMembersAtContract(
  party: Party,
  clients: Map<PlayerId, HubClient>,
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const id of party.memberIds) {
    const c = clients.get(id);
    if (!c || !isNearHubContracts(c.state.x, c.state.y)) {
      missing.push(c?.state.name ?? "?");
    }
  }
  return { ok: missing.length === 0, missing };
}

export function notReadyNames(
  party: Party,
  clients: Map<PlayerId, HubClient>,
): string[] {
  return party.memberIds
    .filter((id) => !party.ready.has(id))
    .map((id) => clients.get(id)?.state.name ?? "?");
}

export function dissolveParty(partyId: string): void {
  const party = parties.get(partyId);
  if (!party) return;
  for (const id of party.memberIds) {
    playerParty.delete(id);
  }
  parties.delete(partyId);
}
