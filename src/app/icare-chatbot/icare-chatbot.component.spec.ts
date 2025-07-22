import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcareChatbotComponent } from './icare-chatbot.component';

describe('IcareChatbotComponent', () => {
  let component: IcareChatbotComponent;
  let fixture: ComponentFixture<IcareChatbotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcareChatbotComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcareChatbotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
