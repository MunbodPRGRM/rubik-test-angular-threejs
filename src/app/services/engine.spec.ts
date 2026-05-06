import { TestBed } from '@angular/core/testing';

import { Engine } from './engine';

describe('Engine', () => {
  let service: Engine;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Engine);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
