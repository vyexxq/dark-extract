import Phaser from "phaser";
import type { PartyInviteInfo } from "@dark-extract/shared";

type AcceptHandler = (inviteId: string) => void;
type DeclineHandler = (inviteId: string) => void;

/** Popup when another hunter invites you — must accept to join. */
export class PartyInviteModal extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private acceptBtn!: Phaser.GameObjects.Text;
  private declineBtn!: Phaser.GameObjects.Text;
  private currentInvite: PartyInviteInfo | null = null;
  private onAccept: AcceptHandler = () => {};
  private onDecline: DeclineHandler = () => {};

  constructor(scene: Phaser.Scene) {
    super(scene, 320, 200);
    scene.add.existing(this);
    this.setScrollFactor(0).setDepth(600).setVisible(false);

    this.bg = scene.add
      .rectangle(0, 0, 280, 120, 0x1a1228, 0.98)
      .setStrokeStyle(2, 0xe8a84a);
    this.title = scene.add
      .text(0, -42, "Party invite", {
        fontSize: "11px",
        color: "#e8a84a",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    this.body = scene.add
      .text(0, -18, "", {
        fontSize: "9px",
        color: "#d8d0e0",
        fontFamily: "monospace",
        align: "center",
        wordWrap: { width: 240 },
      })
      .setOrigin(0.5);

    this.acceptBtn = scene.add
      .text(-50, 32, "[ Y ] Accept", {
        fontSize: "10px",
        color: "#5a8a6a",
        fontFamily: "monospace",
        backgroundColor: "#1a3028",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.declineBtn = scene.add
      .text(50, 32, "[ N ] Decline", {
        fontSize: "10px",
        color: "#c95050",
        fontFamily: "monospace",
        backgroundColor: "#301818",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.acceptBtn.on("pointerdown", () => {
      if (this.currentInvite) {
        this.onAccept(this.currentInvite.inviteId);
        this.hide();
      }
    });
    this.declineBtn.on("pointerdown", () => {
      if (this.currentInvite) {
        this.onDecline(this.currentInvite.inviteId);
        this.hide();
      }
    });

    this.add([this.bg, this.title, this.body, this.acceptBtn, this.declineBtn]);
  }

  setHandlers(onAccept: AcceptHandler, onDecline: DeclineHandler): void {
    this.onAccept = onAccept;
    this.onDecline = onDecline;
  }

  show(invite: PartyInviteInfo): void {
    this.currentInvite = invite;
    this.body.setText(`${invite.fromName} wants you\nin their party (max 3)`);
    this.setVisible(true);
  }

  hide(): void {
    this.currentInvite = null;
    this.setVisible(false);
  }

  isOpen(): boolean {
    return this.visible;
  }

  getInviteId(): string | null {
    return this.currentInvite?.inviteId ?? null;
  }
}
