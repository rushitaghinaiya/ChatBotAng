import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ICareChatbotComponent } from './icare-chatbot.component';

describe('ICareChatbotComponent', () => {
  let component: ICareChatbotComponent;
  let fixture: ComponentFixture<ICareChatbotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ICareChatbotComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ICareChatbotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
