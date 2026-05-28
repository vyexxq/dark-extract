import Phaser from "phaser";
import type { PartyState } from "@dark-extract/shared";
import type { PlayerId } from "@dark-extract/shared";

/** Shows party ready status at the Contracts board. */
export class ContractPanel extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 320, 72);
    scene.add.existing(this);
    this.setScrollFactor(0).setDepth(150).setVisible(false);

    this.bg = scene.add
      .rectangle(0, 0, 300, 56, 0x121018, 0.88)
      .setStrokeStyle(1, 0x4a3a5c);
    this.title = scene.add
      .text(0, -18, "Goblin Cave Contract", {
        fontSize: "10px",
        color: "#e8a84a",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    this.status = scene.add
      .text(0, 0, "", {
        fontSize: "9px",
        color: "#c4b5fd",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    this.hint = scene.add
      .text(0, 16, "", {
        fontSize: "8px",
        color: "#8a7f96",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.add([this.bg, this.title, this.status, this.hint]);
  }

  refresh(
    party: PartyState | null,
    myId: PlayerId,
    atContract: boolean,
    solo: boolean,
  ): void {
    if (!atContract) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);

    if (solo || !party || party.members.length < 2) {
      this.status.setText("Solo — Goblin Cave");
      this.hint.setText("[E] Start solo run now");
      this.hint.setColor("#5a8a6a");
      return;
    }

    const me = party.members.find((m) => m.playerId === myId);
    const isLeader = party.leaderId === myId;
    const readyCount = party.members.filter((m) => m.ready).length;
    const atCount = party.members.filter((m) => m.atContract).length;
    const allReady = party.members.every((m) => m.ready);
    const allHere = atCount === party.members.length;

    const lines = party.members
      .map((m) => {
        const r = m.ready ? "✓ ready" : "○ not ready";
        const here = m.atContract ? "" : " (far)";
        return `${m.name}: ${r}${here}`;
      })
      .join("  ·  ");

    this.status.setText(lines);

    if (isLeader) {
      if (allReady && allHere) {
        this.hint.setText("[E] Sign contract — start cave!");
        this.hint.setColor("#5a8a6a");
      } else {
        this.hint.setText(`[R] ready here · ${readyCount}/${party.members.length} ready · leader [E] when all set`);
        this.hint.setColor("#e8a84a");
      }
    } else if (me?.ready) {
      this.hint.setText("Waiting for leader to sign…");
      this.hint.setColor("#8a7f96");
    } else {
      this.hint.setText("[R] Ready up at the board");
      this.hint.setColor("#e8a84a");
    }
  }
}
