import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ControlsPanel } from './controls-panel';

describe('ControlsPanel', () => {
  let component: ControlsPanel;
  let fixture: ComponentFixture<ControlsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ControlsPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ControlsPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
