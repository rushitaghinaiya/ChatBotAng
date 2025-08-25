import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhoapiComponent } from './whoapi.component';

describe('WhoapiComponent', () => {
  let component: WhoapiComponent;
  let fixture: ComponentFixture<WhoapiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhoapiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WhoapiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
