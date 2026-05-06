import { Component } from '@angular/core';
import { Engine } from '../../services/engine';

@Component({
  selector: 'app-controls-panel',
  imports: [],
  templateUrl: './controls-panel.html',
  styleUrl: './controls-panel.scss',
})
export class ControlsPanel {
  constructor(private engine: Engine) {}

  onShuffle(): void {
    this.engine.shuffleCube();
  }

  onReset(): void {
    this.engine.resetCube();
  }
}
