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

// Add to your existing interfaces
interface Message {
  type: 'bot' | 'user';
  text: string;
  options?: Option[];
  timestamp: string;
  senderName: string;
  responseTime?: number;
  // New properties for multiple answers
  answers?: AnswerData[];
  isExpanded?: boolean;
  hasMultipleAnswers?: boolean;
}

interface AnswerData {
  response: string;
  source: string;
  category: string;
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
  isVerified: boolean;
}

interface BotSession {
  userId: number;
  emailId: string;
  startTime: string; // ISO format (e.g., "2025-07-22T10:00:00Z")
  endTime: string;
  createdAt?: string;
  totalTimeSpent: number; // in seconds
}

export interface Language {
  id: number;
  languageName: string;
  label: string;
  value: string;
  icon: string;
  language_code: string;
  isActive: boolean;
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

  languageOptions: Option[] = [];
  selectedLanguageOption: Option | null = null;


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
    course: '',
    isVerified: false
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
    this.showLanguageSelection();

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

  async showLanguageSelection() {
    try {
      const res = await firstValueFrom(this.getLanguages());
      if (res.success && res.data.length > 0) {
        const languages = res.data.map((lang: Language) => ({
          label: lang.label,
          value: lang.value,
          icon: lang.icon,
          code: lang.language_code
        }));

        this.addBotMessage(
          "Welcome to iCare Life!\n\n" +
          "**Empowering YOU with skill-training for a Brighter Future!**\n\n" +
          "I'm your virtual assistant, here to help you explore our integrated platform for caregiver training and certification. " +
          "Let's start by getting to know you better.\n\n" +
          "Please select your preferred language to continue:",
          languages
        );
        this.awaitingInput = 'langs';
      } else {
        this.addBotMessage("No languages available at the moment.");
      }
    } catch (error) {
      console.error(error);
      this.addBotMessage("Something went wrong while loading languages.");
    }
  }
  getLanguages(): Observable<{ success: boolean, data: Language[] }> {
    return this.http.get<{ success: boolean, data: Language[] }>(`${this.baseUrl}Setting/get_languages`);
  }
  saveUserSession(session: BotSession) {


    session.emailId = this.userData.email;
    const url = `${this.baseUrl}User/SaveUserSession`;
    return this.http.post(url, session);
  }

  // scrollToLatestMessage(): void {
  //   try {
  //     const container = this.scrollContainer.nativeElement;
  //     const scrollHeight = container.scrollHeight;
  //     const clientHeight = container.clientHeight;

  //     // Scroll just enough to bring the new message into view,
  //     // hiding old ones by scrolling to near-bottom
  //     container.scrollTop = scrollHeight - clientHeight - 200; // 40px buffer from bottom
  //   } catch (err) {
  //     console.error('Scroll error', err);
  //   }
  // }

  scrollToLatestMessage(): void {
    try {
      const container = this.scrollContainer.nativeElement;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    } catch (err) {
      console.error('Scroll error', err);
    }
  }


  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTo({
        top: this.scrollContainer.nativeElement.scrollHeight,
        behavior: 'smooth'
      });
    } catch (err) { }
  }

  // addUserMessage(text: string): void {
  //   const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  //   this.messages.push({
  //     type: 'user',
  //     text,
  //     timestamp,
  //     senderName: this.userData.name,
  //   });
  //   this.scrollToBottom();
  // }

  addUserMessage(text: string): void {
    if (this.userInput.trim()) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.messages.push({
        type: 'user',
        text,
        timestamp,
        senderName: this.userData.name
      });

      this.userInput = '';

      // Wait for DOM update, then scroll smoothly
      setTimeout(() => this.scrollToBottom(), 100);
    }
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
        `Nice to meet you, ${input} 🙏. Now, please share your email address so we can verify your access and serve you better.`
      );
      this.addBotMessage(translatedText);

    } else if (this.awaitingInput === 'email') {

      const emailRegex = /^[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}$/u;

      if (!emailRegex.test(input)) {
        const translatedText = await this.translateLang(
          `Please enter a valid email address (e.g., user@example.com).`
        );
        this.addBotMessage(translatedText);
        return;
      }

      this.userData.email = input;
      this.awaitingInput = 'emailverify';

      try {
        const res = await firstValueFrom(this.verifyEmail(input)); // ✅ await instead of subscribe

        if (res.success) {
          this.userData.course = JSON.stringify(res.data.courses);
          this.userData.userType = !res.data.courses || res.data.courses.length === 0
            ? (res.data.isMembership ? 'member' : 'guest')
            : 'student';

          const translatedText = await this.translateLang(
            `Please enter the OTP sent to your email address.`
          );
          const resendOtpLabel = await this.translateLang(`Resend OTP`);
          const editEmailLabel = await this.translateLang(`Edit Email`);

          this.addBotMessage(translatedText, [
            { label: resendOtpLabel, value: 'resendotp', icon: '🔄' },
            { label: editEmailLabel, value: 'editemail', icon: '✏️' }
          ]);
        } else {
          this.addBotMessage(await this.translateLang(`Email not verified.`));
        }
      } catch (err) {
        console.error(err);
        this.addBotMessage(await this.translateLang(`Something went wrong. Please try again.`));
      }
    }

    else if (this.awaitingInput === 'emailverify') {
      this.verifyEmailOtp(input.replace(/\s+/g, '')).subscribe(async (res) => {
        if (res.success) {
          this.userData.isVerified = true;
          const messages: Record<string, string> = {
            guest: `✅ Verified! You can explore general info and courses.`,
            student: `✅ Verified! Your purchased course(s) are now accessible.`,
            member: `✅ Verified! You have full access to all content and premium features.`
          };

          const displayText = messages[this.userData.userType] || '';
          if (displayText) {
            const translatedText = await this.translateLang(displayText);
            this.addBotMessage(translatedText);
          }
          this.awaitingInput = null;
        } else {

          const translatedText = await this.translateLang(
            `Please enter the OTP sent to your email address.`
          );
          const resendOtpLabel = await this.translateLang(`Resend OTP`);
          const editEmailLabel = await this.translateLang(`Edit Email`);

          this.addBotMessage(translatedText, [
            { label: resendOtpLabel, value: 'resendotp', icon: '🔄' },
            { label: editEmailLabel, value: 'editemail', icon: '✏️' }
          ]);
          // translate button labels also

          this.awaitingInput = 'emailverify';
          return;
        }
      });


    }

    else if (this.currentFlow === 'health') {
      this.queryCount += 1;
      const userType = this.userData.userType;

      if (this.queryCount <= environment.freeQuery || userType === 'student' || userType === 'member' || userType === 'guest') {
        this.askQuestion(input);

      }

      else {
        this.awaitingInput = 'name';
        const translatedText = await this.translateLang(
          `🔒 You’ve reached the free limit of ${environment.freeQuery} questions.To continue, may I know your name so we can personalize your experience?`);
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
    this.addUserMessage(option.label);
    this.topic = option.label;

    if (option.value.startsWith('langs_')) {
      this.currentLang.set(option.code || 'en');
      this.currentLanguage = option.label;
      this.selectedLanguageOption = option;  // 👈 keep full option (with flag)

      const translatedText = await this.translateLang(
        `Thank you. You may now ask any questions.`
      );
      const translatedDis = await this.translateLang(`**Disclaimer:**: This information is for knowledge purposes only and not a substitute for professional advice.`)
      this.addBotMessage(translatedText + '\n\n' + translatedDis);
      this.previousFlow.push(this.currentFlow);
      this.currentFlow = 'health';
      return;
    }

    if (option.value === 'resendotp' && this.userData.isVerified == false) {
      this.awaitingInput = 'emailverify';

      try {
        // Convert Observable → Promise
        const res: any = await firstValueFrom(this.verifyEmail(this.userData.email));

        if (res.success) {
          this.userData.course = JSON.stringify(res.data.courses);
          if (!res.data.courses || res.data.courses.length === 0) {
            this.userData.userType = res.data.isMembership ? 'member' : 'guest';
          } else {
            this.userData.userType = 'student';
          }

        } else {
          this.addBotMessage('Email could not be verified. Please try again.');
        }

        // ✅ Resent OTP message
        const resentText = await this.translateLang(
          `We have resent the OTP to your email address: ${this.userData.email}. \n Please enter your OTP below to continue.`
        );
        this.addBotMessage(resentText);
        this.awaitingInput = 'emailverify';
      } catch (error) {
        this.addBotMessage('Something went wrong while verifying your email.');
        console.error(error);
      }
    }
    if (option.value === 'editemail' && this.userData.isVerified == false) {

      const translatedText = await this.translateLang(
        `You choose to edit your email. Please provide a valid email address to proceed.`
      );
      this.addBotMessage(translatedText);
      this.awaitingInput = 'email'
    }
  }
  onLanguageChange(option: Option | null): void {
    if (!option) return;

    this.currentLang.set(option.code || 'en');
    this.currentLanguage = option.label;
    this.selectedLanguageOption = option;

    this.addBotMessage(`✅ Language changed to ${option.label}.`);
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
    return option.icon || '';
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

    // 🧹 Clean text: remove emojis, signs, and special characters
    const cleanText = text
      .replace(/[\p{Emoji_Presentation}\p{Emoji}\p{Extended_Pictographic}]/gu, '') // remove emojis
      .replace(/[^\w\s.,!?'"-]/g, '') // remove other non-speech symbols but keep punctuation
      .replace(/\s+/g, ' ') // collapse extra spaces
      .trim();
    // Delay slightly to avoid "interrupted" error
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(cleanText);
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
    // 🔽 capture language options dynamically
    if (options && options.length > 0) {
      const langs = options.filter(opt => opt.value.startsWith('langs_'));
      if (langs.length > 0 && this.languageOptions.length === 0) {
        this.languageOptions = langs;
        this.selectedLanguageOption = langs[0]; // 👈 Default
      }
    }
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

  // Add method to toggle answer expansion
  toggleAnswerExpansion(messageIndex: number): void {
    if (this.messages[messageIndex]) {
      this.messages[messageIndex].isExpanded = !this.messages[messageIndex].isExpanded;
    }
  }

  // Modified handleHealthQuery method
  async handleHealthQuery(query: string): Promise<void> {
    try {
      debugger;
      const start = Date.now();
      const answersData: AnswerData[] = [];

      if (this.apiResponse?.data?.answers && this.apiResponse.data.answers.length > 0) {
        let validAnswers = this.apiResponse.data.answers;

        // ✅ Case 1: If user has no course and no email → only faq answers
        if (!this.userData.course && !this.userData.email) {
          const filter = validAnswers.filter(a => a.category === 'faq' || a.category === 'ppt');
          if (filter && filter.length > 0) {
            validAnswers = filter;
          }
          if (validAnswers && validAnswers.length > 0 && filter.length == 0) {
            const translatedwarn = await this.translateLang(
              `This content requires login or purchase. Please <a href='https://www.icare.life/' target='_blank'>log in</a> or buy the course to continue.`
            );
            this.messages.pop();
            this.addBotMessage(translatedwarn);
            return;
          }
        }

        for (const answer of validAnswers) {
          const fileNameWithExt = answer.source[0].filename;
          const fileNameWithoutExt = fileNameWithExt?.replace(/\.[^/.]+$/, '');
          const translatedSrc = await this.translateLang(fileNameWithoutExt);

          // ✅ Case 1: Member → allow all categories
          if (this.userData.userType == 'member') {
            answersData.push({
              response: answer.response,
              source: fileNameWithoutExt,
              category: answer.category
            });
          }
          // ✅ Case 2: Student with purchased course → allow only purchased categories
          else if (this.userData.userType == 'student' &&
            this.userData.email &&
            this.userData.course?.includes(answer.category)) {
            answersData.push({
              response: answer.response,
              source: fileNameWithoutExt,
              category: answer.category
            });
          }
          // ✅ Case 3: Always allow faq and ppt
          else if (answer.category === 'faq' || answer.category === 'ppt') {
            answersData.push({
              response: answer.response,
              source: 'Company Data',
              category: answer.category
            });
          }
          // 🚫 Skip others (don’t return immediately)
        }

        // ✅ After processing all answers
        if (answersData.length === 0) {
          const translatedwarn = await this.translateLang(
            `To explore this topic, please <a href='https://www.icare.life/' target='_blank'>buy the course</a> and get full access.`
          );
          this.messages.pop();
          this.addBotMessage(translatedwarn);
          return;
        }

        // ✅ Display collected valid answers
        // for (const ans of answersData) {
        //   this.addBotMessage(ans.response);
        // }

        // ✅ Handle Off Topic
        if (validAnswers.some(a => a.category === 'Off Topic')) {
          const aiResponse = await this.openAIService.getHealthAdviceFromAI(query);
          answersData.splice(0, answersData.length);
          answersData.push({
            response: aiResponse,
            source: 'OpenAI',
            category: 'AI Generated'
          });
        }
      }

      else {
        // No answers from knowledge base, use AI
        const aiResponse = await this.openAIService.getHealthAdviceFromAI(query);
        answersData.push({
          response: aiResponse,
          source: 'OpenAI',
          category: 'AI Generated'
        });
      }

      const end = Date.now();
      const responseTime = parseFloat(((end - start) / 1000).toFixed(2));

      // Remove typing indicator
      this.messages.pop();
      const ref = await this.translateLang(`Source: ${answersData[0].source}`);
      // Translate the first answer for display
      const firstAnswerText = answersData.length > 0
        ? await this.translateLang(`${answersData[0].response}`) + `\n\n` + `${ref}`
        : await this.translateLang('No answer available');


      // Create message with multiple answers support
      this.addBotMessageWithAnswers(
        firstAnswerText,
        answersData,
        responseTime
      );

      // Speak only the first answer
      if (this.voiceEnabled && this.browserSupportsVoice) {
        this.speak(answersData[0]?.response || 'No answer available');
      }
    } catch (error) {
      const translatedTxt = await this.translateLang(
        `I apologize, but I'm having trouble processing your health question right now. Please try again or consult with a healthcare professional directly.`
      );
      this.addBotMessage(translatedTxt);
    }
  }

  // New method to add bot message with answers support
  async addBotMessageWithAnswers(
    text: string,
    answers: AnswerData[],
    resTime: number | null = null
  ): Promise<void> {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // ✅ Ensure Company Data comes first (any Website_Dump)
    const sortedAnswers = [...answers].sort((a, b) => {
      const isCompanySource = (src: string) => src.includes('Website_Dump');

      const aIsCompany = isCompanySource(a.source) ? -1 : 0;
      const bIsCompany = isCompanySource(b.source) ? -1 : 0;

      return bIsCompany - aIsCompany;
    });

    const translatedAnswers: AnswerData[] = [];
    for (const answer of sortedAnswers) {
      const translatedResponse = await this.translateLang(answer.response);

      let sourceText = answer.source;
      if (sourceText.includes('Website_Dump')) {
        sourceText = 'Company Data';
      }
      const translatedSource = await this.translateLang(sourceText);

      translatedAnswers.push({
        response: translatedResponse,
        source: translatedSource + `\n\n`,
        category: answer.category
      });
    }

    this.messages.push({
      type: 'bot',
      text,
      timestamp,
      senderName: this.userData.name,
      responseTime: resTime ?? 0,
      answers: translatedAnswers,
      isExpanded: false,
      hasMultipleAnswers: answers.length > 1
    });

    this.saveQueryHistory();

    setTimeout(() => {
      this.scrollToLatestMessage();
    }, 0);
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
    if (this.userData.email && this.userData.isVerified == true) {
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
  verifyEmail(email: string): Observable<any> {
    const formData = new FormData();
    formData.append('Email', email);
    formData.append('Name', this.userData.name);


    return this.http.post<any>(`${this.baseUrl}UserSignUp/VerifyEmail`, formData);
  }
  verifyEmailOtp(otp: string): Observable<any> {
    const otpVM = {
      emailId: this.userData.email,
      otpNumber: otp
    };

    return this.http.post<any>(`${this.baseUrl}UserSignUp/VerifyOtp`, otpVM);
  }
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}