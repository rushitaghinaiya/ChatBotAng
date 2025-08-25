import { Routes } from '@angular/router';
import { ICareChatbotComponent } from './icare-chatbot/icare-chatbot.component';
import { IcareVoiceComponent } from './icare-voice/icare-voice.component';
import { WhoapiComponent } from './whoapi/whoapi.component';

export const routes: Routes = [
  { path: 'chatbot', component: IcareVoiceComponent },
  { path: '', redirectTo: '/chatbot', pathMatch: 'full' },
  { path: 'who', component: WhoapiComponent }
];
