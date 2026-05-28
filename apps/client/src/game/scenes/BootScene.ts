import Phaser from "phaser";
import { registerGameTextures, registerPlayerAnimations } from "../art/TextureFactory";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    try {
      registerGameTextures(this);
      registerPlayerAnimations(this);
    } catch (err) {
      console.error("[dark-extract] Failed to build pixel textures:", err);
    }

    if (!this.textures.exists("tiles")) {
      console.error("[dark-extract] Tile texture missing after boot");
    }

    this.scene.start("HubScene");
  }
}
