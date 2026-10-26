import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { IcareVoiceComponent } from './icare-voice.component';

describe('IcareVoiceComponent', () => {
  let component: IcareVoiceComponent;
  let fixture: ComponentFixture<IcareVoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcareVoiceComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
