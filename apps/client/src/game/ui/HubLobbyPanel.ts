import Phaser from "phaser";
import { xpProgressInLevel, type PartyState, type PlayerInventory, type PlayerProgression, type PlayerState } from "@dark-extract/shared";
import type { PlayerId } from "@dark-extract/shared";

type InviteHandler = (targetId: PlayerId) => void;
type LeaveHandler = () => void;

/**
 * TAB lobby overlay — profile, party, hunter list with invite buttons.
 */
export class HubLobbyPanel extends Phaser.GameObjects.Container {
  private readonly panelBg: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly profileText: Phaser.GameObjects.Text;
  private readonly partyText: Phaser.GameObjects.Text;
  private readonly listTitle: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly leaveBtn: Phaser.GameObjects.Text;
  private readonly rowTexts: Phaser.GameObjects.Text[] = [];
  private readonly inviteButtons: Phaser.GameObjects.Text[] = [];
  private roster: PlayerState[] = [];
  private myId: PlayerId = "";
  private onInvite: InviteHandler = () => {};
  private onLeave: LeaveHandler = () => {};

  constructor(scene: Phaser.Scene) {
    super(scene, 320, 240);
    scene.add.existing(this);
    this.setScrollFactor(0).setDepth(500).setVisible(false);

    this.panelBg = scene.add
      .rectangle(0, 0, 300, 340, 0x121018, 0.96)
      .setStrokeStyle(2, 0x4a3a5c);
    this.title = scene.add
      .text(0, -150, "Hunter Profile", {
        fontSize: "12px",
        color: "#e8a84a",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    this.profileText = scene.add
      .text(-130, -118, "", {
        fontSize: "9px",
        color: "#c4b5fd",
        fontFamily: "monospace",
        wordWrap: { width: 260 },
      })
      .setOrigin(0, 0);
    this.partyText = scene.add
      .text(-130, -78, "", {
        fontSize: "9px",
        color: "#8a7f96",
        fontFamily: "monospace",
        wordWrap: { width: 260 },
      })
      .setOrigin(0, 0);
    this.listTitle = scene.add
      .text(-130, -48, "Hunters in hub", {
        fontSize: "9px",
        color: "#e8a84a",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0);
    this.hintText = scene.add
      .text(0, 150, "[Tab] close · invites need accept · [R] at Contracts", {
        fontSize: "8px",
        color: "#6a5f76",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    this.leaveBtn = scene.add
      .text(0, 128, "[ Leave party ]", {
        fontSize: "9px",
        color: "#c95050",
        fontFamily: "monospace",
        backgroundColor: "#301818",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.leaveBtn.on("pointerdown", () => this.onLeave());

    this.add([
      this.panelBg,
      this.title,
      this.profileText,
      this.partyText,
      this.listTitle,
      this.leaveBtn,
      this.hintText,
    ]);

    for (let i = 0; i < 6; i++) {
      const row = scene.add
        .text(-130, -28 + i * 26, "", {
          fontSize: "9px",
          color: "#d8d0e0",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0);
      const btn = scene.add
        .text(95, -28 + i * 26, "[ Invite ]", {
          fontSize: "9px",
          color: "#9b6bff",
          fontFamily: "monospace",
          backgroundColor: "#2a2238",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
      btn.on("pointerdown", () => {
        const id = btn.getData("playerId") as PlayerId;
        if (id) this.onInvite(id);
      });
      this.rowTexts.push(row);
      this.inviteButtons.push(btn);
      this.add([row, btn]);
    }
  }

  setInviteHandler(fn: InviteHandler): void {
    this.onInvite = fn;
  }

  setLeaveHandler(fn: LeaveHandler): void {
    this.onLeave = fn;
  }

  setMyId(id: PlayerId): void {
    this.myId = id;
  }

  toggle(): boolean {
    this.setVisible(!this.visible);
    return this.visible;
  }

  isOpen(): boolean {
    return this.visible;
  }

  refresh(
    playerName: string,
    progression: PlayerProgression,
    inventory: PlayerInventory,
    party: PartyState | null,
    roster: PlayerState[],
  ): void {
    this.roster = roster;
    const xp = xpProgressInLevel(progression);
    const mats =
      inventory.materials.map((m) => `${m.id}×${m.qty}`).join(", ") || "none";
    this.profileText.setText(
      `${playerName}\nLv ${progression.level} · XP ${xp.current}/${xp.needed}\nGold ${inventory.gold} · ${mats}`,
    );

    const inParty = party && party.members.length > 1;
    this.leaveBtn.setVisible(!!inParty);

    if (inParty) {
      const lines = party.members
        .map((m) => {
          const tags = [
            m.isLeader ? "leader" : "",
            m.ready ? "ready" : "not ready",
            m.atContract ? "at board" : "away",
          ].filter(Boolean);
          return `· ${m.name} — ${tags.join(", ")}`;
        })
        .join("\n");
      this.partyText.setText(`Party (${party.members.length}/3)\n${lines}`);
    } else {
      this.partyText.setText("Party: solo — invite hunters (they must accept)");
    }

    const others = roster.filter((p) => p.id !== this.myId);
    for (let i = 0; i < this.rowTexts.length; i++) {
      const p = others[i];
      const row = this.rowTexts[i]!;
      const btn = this.inviteButtons[i]!;
      if (!p) {
        row.setText("");
        btn.setVisible(false);
        continue;
      }
      row.setText(`${p.name}  ·  Lv${p.level ?? 1}`);
      btn.setVisible(true);
      btn.setData("playerId", p.id);
      const inParty = party?.members.some((m) => m.playerId === p.id);
      btn.setText(inParty ? "In party" : "[ Invite ]");
      btn.setColor(inParty ? "#6a5f76" : "#9b6bff");
      if (inParty) btn.disableInteractive();
      else btn.setInteractive({ useHandCursor: true });
    }
  }
}
