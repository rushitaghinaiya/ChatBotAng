// icare-chatbot.component.ts
import { Component, OnInit, signal, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { OpenAIService } from '../Services/open-ai.service';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { environment } from '../constants/environment';
import { LanguageService } from '../Services/language.service';
import { TranslationService } from '../Services/translation.service';
import { firstValueFrom } from 'rxjs';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';

// Speech Recognition interface declarations
declare var webkitSpeechRecognition: any;
declare var SpeechRecognition: any;

// Extend Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    //speechSynthesis: SpeechSynthesis;
  }
}

interface Message {
  type: 'bot' | 'user';
  text: string;
  options?: Option[];
  timestamp: string;
  senderName: string;
  responseTime?: number;
}

interface Option {
  label: string;
  value: string;
  icon?: string;
  code?: string;
}

interface UserData {
  name: string;
  mobile: string;
  email: string;
  userType: string;
  language: string;
  course: string;
}

interface BotSession {
  userId: number;
  emailId: string;
  startTime: string; // ISO format (e.g., "2025-07-22T10:00:00Z")
  endTime: string;
  createdAt?: string;
  totalTimeSpent: number; // in seconds
}

// models/qna.model.ts

export interface ApiResponseVM<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface QnAResponse {
  question: string;
  answers: Answer[];
}

export interface Answer {
  category: string;
  response: string;
  source: Source[];
}

export interface Source {
  filename: string;
  timestamps: string[];
}


@Component({
  selector: 'app-icare-voice',
  imports: [CommonModule, FormsModule],
  templateUrl: './icare-voice.component.html',
  styleUrls: ['./icare-voice.component.css']
})
export class IcareVoiceComponent implements OnInit {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  userId: number = 0;
  messages: Message[] = [];
  userInput: string = '';
  currentFlow: string = 'welcome';
  userData: UserData = {
    name: '',
    mobile: '',
    email: '',
    userType: '',
    language: '',
    course: ''
  };
  apiResponse: ApiResponseVM<QnAResponse> | null = null;
  queryCount: number = 0;
  translations: any = {};
  chatJson: any[] = [];;
  currentLang = signal<string>('en');// default, update dynamically later
  currentLanguage = 'English';
  botSession: BotSession = {
    userId: 0,
    emailId: '',
    startTime: '',
    endTime: '',
    createdAt: '',
    totalTimeSpent: 0
  }
  awaitingInput: string | null = null;
  previousFlow: string[] = [];
  isLoggedIn: boolean = false;
  // Voice-related properties
  recognition: any;
  isListening: boolean = false;
  isSpeaking: boolean = false;
  speechSynthesis: any;
  voiceEnabled: boolean = true;
  browserSupportsVoice: boolean = false;
  topic: string = '';
  baseUrl: string = environment.API_BASE_URL;
  userIp: string = '';
  private currentSessionId: string;

  constructor(private http: HttpClient, private translationService: TranslationService, private languageService: LanguageService, private openAIService: OpenAIService, private cdr: ChangeDetectorRef, private ngZone: NgZone) {

    this.speechSynthesis = window.speechSynthesis;
    // Check browser support for speech recognition
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      this.browserSupportsVoice = true;
      this.initializeSpeechRecognition(SpeechRecognitionAPI);
    }
    this.currentSessionId = this.generateSessionId();
  }

  ngOnInit() {
    this.botSession.startTime = new Date().toISOString();// Record start time
    this.addBotMessage(
      "Welcome to iCare Life!\n\n" +
      "**Empowering YOU with skill-training for a Brighter Future!**\n\n" +
      "I'm your virtual assistant, here to help you explore our integrated platform for caregiver training and certification. " +
      "Let's start by getting to know you better.\n\n" +
      "Please select your preferred language to continue:",
      [
        { label: 'English', value: 'langs_english', icon: '🇬🇧', code: 'en' },
        { label: 'French', value: 'langs_french', icon: '🇫🇷', code: 'fr' },
        { label: 'German', value: 'langs_german', icon: '🇩🇪', code: 'de' },
        { label: 'Italian', value: 'langs_italian', icon: '🇮🇹', code: 'it' },
        { label: 'Polish', value: 'langs_polish', icon: '🇵🇱', code: 'pl' },
        { label: 'Portuguese', value: 'langs_portuguese', icon: '🇵🇹', code: 'pt' },
        { label: 'Romanian', value: 'langs_romanian', icon: '🇷🇴', code: 'ro' },
        { label: 'Russian', value: 'langs_russian', icon: '🇷🇺', code: 'ru' },
        { label: 'Spanish', value: 'langs_spanish', icon: '🇪🇸', code: 'es' }
      ]

    );
    this.awaitingInput = 'langs';

    // Speak welcome message if voice is enabled
    if (this.voiceEnabled && this.browserSupportsVoice) {
      // this.speak("Welcome to iCare Life! I'm your virtual assistant. Let's start by getting to know you better. What's your name?");
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: Event): void {
    this.calculateTimeSpent();
  }

  ngOnDestroy(): void {
    this.calculateTimeSpent();
  }

  public calculateTimeSpent(): void {
    const endTime = new Date(); // create Date object
    this.botSession.endTime = endTime.toISOString(); // send as ISO string

    this.botSession.totalTimeSpent = Math.floor(
      (endTime.getTime() - new Date(this.botSession.startTime).getTime()) / 1000
    );

    if (this.userData.email) {
      this.saveUserSession(this.botSession).subscribe({
        next: (res) => {
          console.log('User session saved successfully:', res);
        },
        error: (err) => {
          console.error('Error saving user session:', err);
        }
      });
    }
  }

  saveUserSession(session: BotSession) {


    session.emailId = this.userData.email;
    const url = `${this.baseUrl}User/SaveUserSession`;
    return this.http.post(url, session);
  }

  scrollToLatestMessage(): void {
    try {
      const container = this.scrollContainer.nativeElement;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // Scroll just enough to bring the new message into view,
      // hiding old ones by scrolling to near-bottom
      container.scrollTop = scrollHeight - clientHeight - 200; // 40px buffer from bottom
    } catch (err) {
      console.error('Scroll error', err);
    }
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  addUserMessage(text: string): void {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.messages.push({
      type: 'user',
      text,
      timestamp,
      senderName: this.userData.name,
    });
    this.scrollToBottom();
  }

  async handleUserInput(input: string): Promise<void> {
    this.addUserMessage(input.trim());

    if (this.awaitingInput === 'name') {
      // Name validation: only letters and at least 2 characters
      const nameRegex = /^[\p{L}\p{M} ]{2,}$/u;
      if (!nameRegex.test(input)) {
        const translatedText = await this.translateLang(
          `Please enter a valid name (only alphabets, minimum 2 characters).`
        );
        this.addBotMessage(translatedText);
        return;
      }

      this.userData.name = input;
      this.awaitingInput = 'email';
      const translatedText = await this.translateLang(
        `Nice to meet you, ${input} 🙏 Now, please share your email address so we can verify your access and serve you better.`
      );
      this.addBotMessage(translatedText);

    } else if (this.awaitingInput === 'email')  //Add new if for email
    {
      // Email validation
      const emailRegex = /^[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}$/u;

      if (!emailRegex.test(input)) {
        const translatedText = await this.translateLang(
          `Please enter a valid email address (e.g., user@example.com).`
        );
        this.addBotMessage(translatedText);
        return;
      }
      const email = await firstValueFrom(
        this.translationService.translateText(input, 'en')
      );
      this.userData.email = email;
      this.awaitingInput = 'emailverify';
      // ✅ If valid email, you can call your API here
      this.login(input).subscribe((res) => {
        if (res.success) {
          this.userData.course = JSON.stringify(res.data);
          if (!res.data || res.data.length === 0) {
            this.userData.userType = 'member';
          } else {
            this.userData.userType = 'student';
          }
          //this.addBotMessage("✅ Verified successfully! Your courses have been saved.");

          this.addBotMessage(`Please enter an otp that sent on your given email address.`);
        } else {
          this.addBotMessage(
            `To view course content, please <a href="https://www.icare.life/" target="_blank">log in or purchase the course</a>.`
          );

        }
      });
    }
    else if (this.awaitingInput === 'emailverify')  //Add new if for email
    {
      // Email validation

      if (input == '123456') {
        const translatedText = await this.translateLang(
          `✅ Verified successfully! Your courses have been saved. You can ask anythings related to your cources and general healthcare`
        );
        this.addBotMessage(translatedText);
      }
      else {
        const translatedText = await this.translateLang(
          `please enter a valid otp`
        );
        this.addBotMessage(translatedText);
        this.awaitingInput = 'emailverify';
        return;
      }




      this.awaitingInput = null;

    }
    else if (this.currentFlow === 'health') {
      this.queryCount += 1;
      const userType = this.userData.userType;

      if (this.queryCount <= environment.freeQuery || userType === 'student' || userType === 'member') {
        this.askQuestion(input);

      }
      else {
        this.awaitingInput = 'name';
        const translatedText = await this.translateLang(
          `🔒 You’ve reached the free limit of 3 questions.To continue, may I know your name so we can personalize your experience?`);
        this.addBotMessage(translatedText);
      }

    }
  }

  onLogin() {
    this.login(this.userData.email).subscribe((res) => {
      if (res.success) {
        // store courses in localStorage
        localStorage.setItem('courses', JSON.stringify(res.data));
        if (!res.data || res.data.length === 0) {
          localStorage.setItem('userType', 'member');
        } else {
          localStorage.setItem('userType', 'student');
        }
        alert(res.message); // "User exists"
      } else {
        alert(res.message); // "User not found"
      }
    });
  }

  login(email: string) {
    return this.http.post<any>(`${this.baseUrl}UserSignUp/VerifyEmail`, { email });
  }

  async handleOptionClick(option: Option): Promise<void> {
    //option.label = option.label.split(' ')[1];
    this.addUserMessage(option.label);
    this.topic = option.label;

    if (option.value.startsWith('langs_')) {
      this.currentLang.set(option.code || 'en');
      this.currentLanguage = option.label;
      const translatedText = await this.translateLang(
        `Thank you for selecting ${option.label}. You may now ask any questions.`
      );
      this.addBotMessage(translatedText);
      this.previousFlow.push(this.currentFlow);
      this.currentFlow = 'health';
      return;
      //this.showGuestMenu();
    }
  }

  onSubmit(): void {
    if (this.userInput.trim()) {
      this.handleUserInput(this.userInput);
      this.userInput = '';
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSubmit();
    }
  }

  formatMessage(text: string): string {
    // Convert markdown-style bold to HTML
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  getOptionIcon(option: Option): string {
    return option.icon || option.label.slice(0, 2);
  }

  getOptionLabel(option: Option): string {
    return option.label;
    // return option.label.length > 2 ? option.label.slice(2).trim() : option.label;
  }

  // Voice Recognition Methods
  initializeSpeechRecognition(SpeechRecognitionAPI: any): void {
    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.ngZone.run(() => {
        this.isListening = true;
      });
    };

    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');

      this.userInput = transcript;

      if (event.results[0].isFinal) {
        this.handleUserInput(transcript);
        this.userInput = '';
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.ngZone.run(() => {
        this.isListening = false;
      });

      if (event.error === 'no-speech') {
        this.addBotMessage('I didn\'t hear anything. Please try again.');
      } else if (event.error === 'not-allowed') {
        this.addBotMessage('Microphone access is required for voice commands. Please enable it in your browser settings.');
        this.voiceEnabled = false;
      }
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        this.isListening = false;
      });
    };
  }

  toggleVoiceInput(): void {
    if (!this.browserSupportsVoice) {
      this.addBotMessage('Sorry, your browser doesn\'t support voice commands.');
      return;
    }

    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  startListening(): void {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.userInput = '';
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();

      // Update inside Angular zone to trigger change detection
      this.ngZone.run(() => {
        this.isListening = false;
      });
    }
  }

  speak(text: string): void {
    if (!this.speechSynthesis || !this.voiceEnabled) return;

    // Cancel any ongoing speech
    this.speechSynthesis.cancel();

    // Delay slightly to avoid "interrupted" error
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      // ... all your voice config

      utterance.onstart = () => {
        this.ngZone.run(() => {
          this.isSpeaking = true;
        });
      };

      utterance.onend = () => {
        this.ngZone.run(() => {
          this.isSpeaking = false;
        });
      };

      utterance.onerror = (event: any) => {
        console.error('Speech synthesis error:', event);
        this.ngZone.run(() => {
          this.isSpeaking = false;
        });
      };

      this.speechSynthesis.speak(utterance);

    }, 250); // 👈 delay 150ms before speaking

  }

  toggleVoice(): void {

    this.voiceEnabled = !this.voiceEnabled;
    if (!this.voiceEnabled) {
      this.speechSynthesis.cancel();
      this.stopListening();
      this.isSpeaking = false;
    }
  }
  async translateLang(text: string): Promise<string> {

    // Translate user message to selected language
    return await firstValueFrom(
      this.translationService.translateText(text, this.currentLang())
    );
  }
  // Override addBotMessage to include speech
  addBotMessage(text: string, options: Option[] | null = null, resTime: number | null = null): void {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.messages.push({
      type: 'bot',
      text,
      options: options || undefined,
      timestamp,
      senderName: this.userData.name,
      responseTime: resTime == null ? 0 : resTime
    });

    if (this.messages[this.messages.length - 1].text != 'thinking') {
      this.saveQueryHistory();
    }
    // Delay to allow DOM update
    setTimeout(() => {
      this.scrollToLatestMessage();
    }, 0);
    //Speak the message if voice is enabled
    if (this.voiceEnabled && this.browserSupportsVoice && !options) {
      this.speak(text);
    }
  }

  // Override handleHealthQuery to speak the response
  async handleHealthQuery(query: string): Promise<void> {
    // Show typing indicator
    debugger;
    try {
      let healthAdvice: any = '';
      const start = Date.now();
      //.net API call
      if (this.apiResponse?.data?.answers && this.apiResponse.data.answers.length > 0) {
        if (this.apiResponse.data.answers[0].category != 'Off Topic') {
          healthAdvice = this.apiResponse.data.answers[0].response;
        }
        else {
          healthAdvice = await this.openAIService.getHealthAdviceFromAI(query);
        }
      }
      else {
        healthAdvice = await this.openAIService.getHealthAdviceFromAI(query);
      }
      // Simulate API call

      const end = Date.now();
      const responseTime = parseFloat(((end - start) / 1000).toFixed(2));
      // Remove typing indicator
      this.messages.pop();
      console.log(responseTime);
      const translatedhealthAdvice = await this.translateLang(
        healthAdvice);
      const translatedTex = await this.translateLang(
        `⚠️ **Important Disclaimer:** This information is for educational purposes only and should not replace professional medical advice. ` +
        `Always consult with qualified healthcare professionals for personalized medical guidance.`);
      const response = `${translatedhealthAdvice}\n\n` +
        translatedTex;

      this.addBotMessage(
        response,
        null, responseTime
      );

      // Speak the health advice
      if (this.voiceEnabled && this.browserSupportsVoice) {
        this.speak(healthAdvice + ". Important: This information is for educational purposes only. Always consult with qualified healthcare professionals for personalized medical guidance.");
      }
    } catch (error) {
      this.messages.pop();
      this.addBotMessage(
        `I apologize, but I'm having trouble processing your health question right now. ` +
        `Please try again or consult with a healthcare professional directly.`,
        [
          { label: '🔄 Try Again', value: 'health' },
          { label: '⬅️ Back to Previous Menu', value: 'back' },
          { label: '🏠 Back to Main Menu', value: 'mainMenu' }
        ]
      );
    }
  }


  /**
    * Get knowledge base list from API
    */
  private GetFileQnaAnswer(question: string): Observable<ApiResponseVM<QnAResponse>> {
    let params = new HttpParams();

    params = params.set('dbType', 'LIVE');
    params = params.set('kbName', 'medicare');
    params = params.set('language', this.currentLanguage.toString());
    params = params.set('question', question);

    const url = `${this.baseUrl}MedicareKnowledgeBase/file-qna/ISG`;
    return this.http.post<ApiResponseVM<QnAResponse>>(url, null, { params });

  }
  askQuestion(question: string) {
    this.addBotMessage('thinking');
    this.GetFileQnaAnswer(question)
      .subscribe({
        next: (res) => {
          this.apiResponse = res;
          console.log('API Response:', res);

          this.handleHealthQuery(question);
        },
        error: (err) => {
          console.error('API Error:', err);
        }
      });
  }
  saveQueryHistory() {
    if (this.userData.email && this.messages.length >= 16) {
      const queryText = this.messages[this.messages.length - 2];
      const responseText = this.messages[this.messages.length - 1] || {};

      // ✅ Always make sure chatJson is an array
      if (!Array.isArray(this.chatJson)) {
        this.chatJson = [];
      }

      const newEntry = {
        queryText: queryText.text || '',
        responseText: responseText.text || '',
        responseTime: responseText.responseTime || null,
        topic: '',
        status: responseText.text ? 'Answered' : 'Unanswered'
      };

      // ✅ Append safely
      this.chatJson.push(newEntry);

      const queryDto = {
        emailId: this.userData.email,
        sessionId: this.currentSessionId,
        chatJson: JSON.stringify(this.chatJson), // 👈 stringify here
        queryText: queryText.text || '',
        responseText: responseText.text || '',
        responseTime: responseText.responseTime || null,
        topic: '',
        status: responseText.text ? 'Answered' : 'Unanswered'
      };

      this.http.post(`${this.baseUrl}user/SaveQueryHistory`, queryDto).subscribe({
        next: res => console.log('Saved:', res),
        error: err => console.error('Save failed:', err)
      });
    }
  }


  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}