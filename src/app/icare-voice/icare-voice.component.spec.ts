import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcareVoiceComponent } from './icare-voice.component';

describe('IcareVoiceComponent', () => {
  let component: IcareVoiceComponent;
  let fixture: ComponentFixture<IcareVoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcareVoiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcareVoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
