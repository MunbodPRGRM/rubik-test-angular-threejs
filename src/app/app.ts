import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Engine } from './services/engine';
import { ControlsPanel } from "./components/controls-panel/controls-panel";

@Component({
  selector: 'app-root',
  imports: [ControlsPanel],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements AfterViewInit {
  @ViewChild('rendererCanvas', { static: true })
  public rendererCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(private engine: Engine) {}

  ngAfterViewInit(): void {
    // สั่งให้ Service เริ่มวาดภาพทันทีที่โหลด Canvas เสร็จ
    this.engine.createScene(this.rendererCanvas);
  }
}
