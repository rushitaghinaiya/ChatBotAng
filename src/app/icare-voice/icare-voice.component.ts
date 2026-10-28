// icare-chatbot.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { OpenAIService } from '../Services/open-ai.service';
import { TranslationService } from '../Services/translation.service';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { environment } from '../constants/environment';
import { Observable, firstValueFrom } from 'rxjs';

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
  topic: string;
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
  userType: string;
  language: string;
}

interface BotSession {
  userId: number;
  startTime: string; // ISO format (e.g., "2025-07-22T10:00:00Z")
  endTime: string;
  createdAt?: string;
  totalTimeSpent: number; // in seconds
}

@Component({
  selector: 'app-icare-voice',
  imports: [CommonModule, FormsModule],
  templateUrl: './icare-voice.component.html',
  styleUrls: ['./icare-voice.component.css']
})
export class IcareVoiceComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  userId: number = 0;
  messages: Message[] = [];
  userInput: string = '';
  currentFlow: string = 'welcome';
  userData: UserData = {
    name: '',
    mobile: '',
    userType: '',
    language: ''
  };
  botSession: BotSession = {
    userId: 0,
    startTime: '',
    endTime: '',
    createdAt: '',
    totalTimeSpent: 0
  }
  awaitingInput: string | null = null;
  previousFlow: string[] = [];
  isLoggedIn: boolean = false;
  pendingOtpUserId: number = 0;
  otpVerified: boolean = false;
  // Voice-related properties
  muted: boolean = false;
  recognition: any;
  isListening: boolean = false;
  isSpeaking: boolean = false;
  speechSynthesis: any;
  voiceEnabled: boolean = true;
  browserSupportsVoice: boolean = false;
  topic: string = '';
  baseUrl: string = environment.API_BASE_URL;
  userIp: string = '';


  constructor(private http: HttpClient, private openAIService: OpenAIService, private translationService: TranslationService, private cdr: ChangeDetectorRef, private ngZone: NgZone) {

    this.speechSynthesis = window.speechSynthesis;
    // Check browser support for speech recognition
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      this.browserSupportsVoice = true;
      this.initializeSpeechRecognition(SpeechRecognitionAPI);
    }

  }

  ngOnInit() {
    this.botSession.startTime = new Date().toISOString();
    this.showLanguageSelection();
  }

  async showLanguageSelection() {
    try {
      const res = await firstValueFrom(this.getLanguages());
      if (res.success && res.data.length > 0) {
        const languages = res.data.map((lang: any) => ({
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
        this.fallbackToNamePrompt();
      }
    } catch (error) {
      console.error('Failed to load languages:', error);
      this.fallbackToNamePrompt();
    }
  }

  // Translates text to the user's selected language before displaying it.
  // Returns original text immediately if translation is disabled or language is English.
  private async translateMessage(text: string): Promise<string> {
    return firstValueFrom(
      this.translationService.translateText(text, this.userData.language || 'en')
    );
  }

  private async fallbackToNamePrompt() {
    const msg = await this.translateMessage(
      "Welcome to iCare Life!\n\n" +
      "**Empowering YOU with skill-training for a Brighter Future!**\n\n" +
      "I'm your virtual assistant, here to help you explore our integrated platform for caregiver training and certification. " +
      "Let's start by getting to know you better.\n\n" +
      "What's your name?"
    );
    this.addBotMessage(msg);
    this.awaitingInput = 'name';
  }

  getLanguages(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.baseUrl}Setting/get_languages`);
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

    this.saveUserSession(this.botSession).subscribe({
      next: (res) => {
        console.log('User session saved successfully:', res);
      },
      error: (err) => {
        console.error('Error saving user session:', err);
      }
    });
  }

  saveUserSession(session: BotSession) {

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      session.userId = user.id;
      this.userId = user.id;
    }

    const url = `${this.baseUrl}User/SaveUserSession`;
    return this.http.post(url, session);
  }
  ngAfterViewChecked() {
    // this.scrollToBottom();
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
      topic: this.topic
    });
    this.scrollToBottom();
  }

 async handleUserInput(input: string): Promise<void> {
  this.addUserMessage(input.trim());

  if (this.awaitingInput === 'name') {
    // Name validation: only letters and at least 2 characters
    const nameRegex = /^[a-zA-Z ]{2,}$/;
    if (!nameRegex.test(input)) {
      const msg = await this.translateMessage("Please enter a valid name (only alphabets, minimum 2 characters).");
      this.addBotMessage(msg);
      return;
    }

    this.userData.name = input;
    this.awaitingInput = 'mobile';
    const msg = await this.translateMessage(
      `Nice to meet you, ${input}! 😊\n\nCould you please share your phone number so we can keep you updated about our programs?`
    );
    this.addBotMessage(msg);

  } else if (this.awaitingInput === 'mobile') {
    // Mobile validation: 10 digits only
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(input)) {
      const msg = await this.translateMessage("Please enter a valid 10-digit mobile number (numbers only).");
      this.addBotMessage(msg);
      return;
    }

    this.userData.mobile = input;
    this.awaitingInput = null;
    this.currentFlow = 'userType';
    this.showUserTypeSelection();

  } else if (this.awaitingInput === 'otp') {
    const otpRegex = /^[0-9]{4,8}$/;
    if (!otpRegex.test(input.trim())) {
      const msg = await this.translateMessage('Please enter a valid numeric OTP.');
      this.addBotMessage(msg);
      return;
    }
    this.verifyOtp(input.trim());
    return;  // verifyOtp is async internally, skip the saveUserInfo() call below

  } else if (this.awaitingInput === 'language') {
    this.userData.language = input;
    this.showCourseDetails(input);

  } else if (this.currentFlow === 'health') {
    this.handleHealthQuery(input);

  } else {
    this.handleGeneralInput(input);
  }

  // Save only if both fields are filled and valid
  if (this.userData.name && this.userData.mobile) {
    this.saveUserInfo();
  }
}

  saveUserInfo(): void {
    if (this.userData.name && this.userData.mobile && this.isLoggedIn == false) {
      this.http.post<any>(`${this.baseUrl}UserSignUp/SignUp`, this.userData)
        .subscribe({
          next: (res) => {
            console.log('User saved:', res);
            if (res.success && res.data) {
              const { user } = res.data;
              localStorage.setItem('user', JSON.stringify(user));
              this.userId = user.id;
              this.pendingOtpUserId = user.id;
              this.promptForOtp();
            }
          },
          error: (err) => console.error('Save failed:', err)
        });
    }
  }

  async promptForOtp(): Promise<void> {
    const msg = await this.translateMessage(
      `We've sent a verification code to your mobile number.\n\nPlease enter the 6-digit OTP to continue:`
    );
    this.addBotMessage(msg);
    this.awaitingInput = 'otp';
  }

  verifyOtp(otpNumber: string): void {
    this.http.post<any>(`${this.baseUrl}UserSignUp/VerifyMobileOtp`, {
      UserId: this.pendingOtpUserId,
      OtpNumber: otpNumber
    }).subscribe({
      next: async (res) => {
        if (res.success && res.data) {
          const { accessToken, refreshToken, tokenExpiration, tokenType } = res.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          localStorage.setItem('tokenExpiration', tokenExpiration);
          localStorage.setItem('tokenType', tokenType ?? 'Bearer');
          this.isLoggedIn = true;
          this.otpVerified = true;
          this.awaitingInput = null;
          const msg = await this.translateMessage('Mobile number verified successfully! ✅');
          this.addBotMessage(msg);
        } else {
          const errorCode = res.errorCode ?? '';
          let errText = 'Invalid OTP. Please try again.';
          if (errorCode === 'OTP_EXPIRED') {
            errText = 'Your OTP has expired. Please request a new one.';
          } else if (errorCode === 'OTP_NOT_FOUND') {
            errText = 'No OTP found. Please request a new one.';
          }
          const msg = await this.translateMessage(errText);
          this.addBotMessage(msg);
          // keep awaitingInput = 'otp' so user can retry
        }
      },
      error: async (err) => {
        console.error('OTP verification failed:', err);
        const msg = await this.translateMessage('Verification failed. Please try again.');
        this.addBotMessage(msg);
      }
    });
  }

  handleOptionClick(option: Option): void {
    this.addUserMessage(option.label);
    this.topic = option.label;

    if (option.value.startsWith('langs_')) {
      this.userData.language = option.code || 'en';
      this.fallbackToNamePrompt();
      return;
    }

    if (option.value === 'student' || option.value === 'partner' || option.value === 'guest') {
      this.userData.userType = option.value;
      this.previousFlow.push(this.currentFlow);
      this.currentFlow = option.value;

      if (option.value === 'student') {
        this.showStudentMenu();
      } else if (option.value === 'partner') {
        this.showPartnerInfo();
      } else if (option.value === 'guest') {
        this.showGuestMenu();
      }
    } else if (option.value === 'knowMore') {
      this.previousFlow.push(this.currentFlow);
      this.showAboutICare();
    } else if (option.value === 'curriculum') {
      this.previousFlow.push(this.currentFlow);
      this.showLanguageOptions();
    } else if (option.value === 'caregiving') {
      this.previousFlow.push(this.currentFlow);
      this.showCaregivingModules();
    } else if (option.value === 'pricing') {
      this.previousFlow.push(this.currentFlow);
      this.showPricingInfo();
    } else if (option.value === 'testimonials') {
      this.previousFlow.push(this.currentFlow);
      this.showTestimonials();
    } else if (option.value === 'benefits') {
      this.previousFlow.push(this.currentFlow);
      this.showBenefits();
    } else if (option.value === 'health') {
      this.previousFlow.push(this.currentFlow);
      this.currentFlow = 'health';
      this.showHealthMenu();
    } else if (option.value === 'back') {
      this.handleBackNavigation();
    } else if (option.value === 'mainMenu') {
      this.handleMainMenuNavigation();
    } else if (option.value.startsWith('lang_')) {
      const language = option.value.replace('lang_', '');
      this.userData.language = language;
      this.previousFlow.push(this.currentFlow);
      this.showCourseDetails(language);
    }
  }

  async showUserTypeSelection(): Promise<void> {
    const msg = await this.translateMessage(
      `Thank you! I've saved your mobile information.\n\n` +
      `To provide you with the best information, please tell me - are you a:`
    );
    this.addBotMessage(msg, [
      { label: 'Student', value: 'student', icon: '🎓' },
      { label: 'Partner', value: 'partner', icon: '🤝' },
      { label: 'Guest', value: 'guest', icon: '👋' }
    ]);
  }

  async showStudentMenu(): Promise<void> {
    const msg = await this.translateMessage(
      `Welcome, future caregiver! 🌟\n\n` +
      `I'm excited to help you explore our comprehensive training programs. What would you like to know about?`
    );
    this.addBotMessage(msg, [
      { label: '📚 Know More About iCare', value: 'knowMore' },
      { label: '🎯 View Curriculum & Languages', value: 'curriculum' },
      { label: '💼 Caregiving Modules', value: 'caregiving' },
      { label: '💰 Pricing & Trial Options', value: 'pricing' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showAboutICare(): Promise<void> {
    const msg = await this.translateMessage(
      `**About iCare Life** 🌍\n\n` +
      `**Our Mission:** Empowering individuals worldwide with professional caregiving skills for a brighter future!\n\n` +
      `**Key Features:**\n` +
      `✅ Expert-led online training programs\n` +
      `✅ Level 2 Certification from renowned German certifying body\n` +
      `✅ 24/7 accessible platform - learn anytime, anywhere\n` +
      `✅ Multi-device compatibility\n` +
      `✅ Recognition of Prior Learning (RPL)\n` +
      `✅ Global recognition and career opportunities\n\n` +
      `**Why Choose iCare?**\n` +
      `• Affordable learning with unbeatable skills\n` +
      `• Human-centered care that remains unphased by AI\n` +
      `• International certification opportunities\n` +
      `• Expert mentorship and support`
    );
    this.addBotMessage(msg, [
      { label: '🎯 View Our Courses', value: 'curriculum' },
      { label: '💰 See Pricing', value: 'pricing' },
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showLanguageOptions(): Promise<void> {
    const msg = await this.translateMessage(
      `**Choose Your Language Track** 🌐\n\n` +
      `We offer our caregiving curriculum in multiple language families to serve our global community:`
    );
    this.addBotMessage(msg, [
      { label: '🇩🇪 Germanic Languages', value: 'lang_germanic' },
      { label: '🇫🇷 Romance Languages', value: 'lang_romance' },
      { label: '🇷🇺 Slavic Languages', value: 'lang_slavic' },
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showCourseDetails(language: string): Promise<void> {
    const languageDetails: any = {
      germanic: {
        name: 'Germanic Track',
        languages: 'English, German, Dutch',
        special: 'Direct pathway to German certification'
      },
      romance: {
        name: 'Romance Track',
        languages: 'Spanish, French, Italian, Portuguese',
        special: 'Popular in European and Latin American markets'
      },
      slavic: {
        name: 'Slavic Track',
        languages: 'Russian, Polish, Czech',
        special: 'Growing demand in Eastern European care markets'
      }
    };

    const track = languageDetails[language];
    const msg = await this.translateMessage(
      `**${track.name} - Course Details** 📖\n\n` +
      `**Available in:** ${track.languages}\n` +
      `**Special Feature:** ${track.special}\n\n` +
      `**Course Structure:**\n` +
      `📋 Essential Skills for Caregivers (90 days)\n` +
      `👶 Specialized Childcare Module\n` +
      `👴 Specialized Eldercare Module\n` +
      `🏥 Level 2 Certification Preparation\n\n` +
      `All courses include:\n` +
      `• Interactive video lessons\n` +
      `• Practical assessments\n` +
      `• Expert mentorship\n` +
      `• Certification upon completion`
    );
    this.addBotMessage(msg, [
      { label: '💰 View Pricing', value: 'pricing' },
      { label: '🎯 Other Languages', value: 'curriculum' },
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showCaregivingModules(): Promise<void> {
    const msg = await this.translateMessage(
      `**Comprehensive Caregiving Modules** 💼\n\n` +
      `**1. Essential Skills for Caregivers**\n` +
      `• Communication & interpersonal skills\n` +
      `• Basic medical knowledge\n` +
      `• Safety & emergency procedures\n` +
      `• Ethics in caregiving\n\n` +
      `**2. Childcare Specialization**\n` +
      `• Child development stages\n` +
      `• Nutrition & feeding\n` +
      `• Educational activities\n` +
      `• Child safety & first aid\n\n` +
      `**3. Eldercare Specialization**\n` +
      `• Geriatric care principles\n` +
      `• Mobility assistance\n` +
      `• Medication management\n` +
      `• Dementia & Alzheimer's care\n\n` +
      `**4. Level 2 Certification**\n` +
      `• Advanced caregiving techniques\n` +
      `• International standards compliance\n` +
      `• Professional documentation\n` +
      `• Career advancement strategies`
    );
    this.addBotMessage(msg, [
      { label: '💰 See Pricing', value: 'pricing' },
      { label: '🎯 Choose Language', value: 'curriculum' },
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showPricingInfo(): Promise<void> {
    const msg = await this.translateMessage(
      `**Affordable Pricing Options** 💰\n\n` +
      `**Essential Skills for Caregivers (90 days)**\n` +
      `✅ Single Payment: $139\n` +
      `✅ Monthly Plan: $49/month (3 months)\n\n` +
      `**Specialized Modules**\n` +
      `• Childcare Specialization: $99\n` +
      `• Eldercare Specialization: $99\n\n` +
      `**Level 2 Certification Package**\n` +
      `• Complete Program: $299\n` +
      `• Includes all modules + certification exam\n\n` +
      `**🎁 Special Offer: 3-Day Trial**\n` +
      `Try our platform for just $1!\n` +
      `• Full access to course content\n` +
      `• Experience our learning system\n` +
      `• No commitment required\n\n` +
      `**Payment Methods:** Credit/Debit cards, PayPal, Bank transfer`
    );
    this.addBotMessage(msg, [
      { label: '🚀 Start 3-Day Trial', value: 'trial' },
      { label: '📚 View Courses', value: 'curriculum' },
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showPartnerInfo(): Promise<void> {
    const msg = await this.translateMessage(
      `**Welcome, Potential Partner!** 🤝\n\n` +
      `iCare Life offers exciting partnership opportunities to expand quality caregiving education globally.\n\n` +
      `**Partnership Options:**\n\n` +
      `**1. Franchise Partner**\n` +
      `• Operate iCare training centers\n` +
      `• Access to complete curriculum\n` +
      `• Marketing & operational support\n` +
      `• Territory exclusivity options\n\n` +
      `**2. Care Facilitator Technology Partner**\n` +
      `• Integrate our training platform\n` +
      `• White-label solutions available\n` +
      `• API access for seamless integration\n` +
      `• Technical support & updates\n\n` +
      `**3. Corporate Training Partner**\n` +
      `• Bulk licensing for organizations\n` +
      `• Customized training programs\n` +
      `• Progress tracking & reporting\n` +
      `• Dedicated account management\n\n` +
      `**Benefits of Partnership:**\n` +
      `✅ Proven business model\n` +
      `✅ Growing market demand\n` +
      `✅ Comprehensive support system\n` +
      `✅ Global brand recognition\n` +
      `✅ Positive social impact\n\n` +
      `📧 Contact us at partners@icare.life for detailed information`
    );
    this.addBotMessage(msg, [
      { label: '📊 Request Partnership Details', value: 'partnerDetails' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showGuestMenu(): Promise<void> {
    const msg = await this.translateMessage(
      `**Welcome, Guest!** 👋\n\n` +
      `I'm here to help you explore what iCare Life has to offer. What would you like to know about?`
    );
    this.addBotMessage(msg, [
      { label: '⭐ Read Testimonials', value: 'testimonials' },
      { label: '🎯 Benefits of iCare', value: 'benefits' },
      { label: '❤️ General Health Queries', value: 'health' },
      { label: '📚 Explore Courses', value: 'curriculum' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showTestimonials(): Promise<void> {
    const msg = await this.translateMessage(
      `**Success Stories from Our Global Community** ⭐\n\n` +
      `**Grace Mwangi - Nairobi, Kenya** 🇰🇪\n` +
      `*"iCare Life transformed my career! After completing the Essential Skills course and Level 2 Certification, ` +
      `I now work as a senior caregiver in a prestigious facility. The flexible online learning allowed me to study ` +
      `while caring for my family. The German certification opened doors I never imagined possible!"*\n\n` +
      `**Chen Wei - Shanghai, China** 🇨🇳\n` +
      `*"As someone with no prior healthcare experience, iCare's structured curriculum was perfect. The eldercare ` +
      `specialization gave me confidence to care for aging parents and start my own caregiving service. The ` +
      `multi-language support and 24/7 platform access made learning convenient despite my busy schedule."*\n\n` +
      `**Maria Rodriguez - Madrid, Spain** 🇪🇸\n` +
      `*"The Romance language track made complex medical terms easy to understand. I appreciated the human-centered ` +
      `approach that technology can't replace. Now certified, I earn 40% more than before!"*\n\n` +
      `**Join thousands of successful caregivers worldwide!**`
    );
    this.addBotMessage(msg, [
      { label: '🎯 Learn About Benefits', value: 'benefits' },
      { label: '💰 View Pricing', value: 'pricing' },
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showBenefits(): Promise<void> {
    const msg = await this.translateMessage(
      `**Why Choose iCare Life?** 🌟\n\n` +
      `**Career Advancement** 📈\n` +
      `• International certification recognition\n` +
      `• 30-50% higher earning potential\n` +
      `• Global job opportunities\n` +
      `• Career pathway guidance\n\n` +
      `**Quality Education** 🎓\n` +
      `• Expert-designed curriculum\n` +
      `• Practical, hands-on training\n` +
      `• Regular updates with industry standards\n` +
      `• Mentorship from professionals\n\n` +
      `**Flexibility & Accessibility** 🌐\n` +
      `• Learn at your own pace\n` +
      `• 24/7 platform access\n` +
      `• Multi-device compatibility\n` +
      `• Offline content availability\n\n` +
      `**Global Recognition** 🏆\n` +
      `• German third-party certification\n` +
      `• Accepted in 50+ countries\n` +
      `• Industry partnerships\n` +
      `• Alumni network access\n\n` +
      `**Future-Proof Skills** 🤖\n` +
      `• Human touch that AI can't replace\n` +
      `• Growing demand in aging societies\n` +
      `• Recession-resistant career\n` +
      `• Meaningful work with purpose`
    );
    this.addBotMessage(msg, [
      { label: '📚 Explore Courses', value: 'curriculum' },
      { label: '⭐ Read Testimonials', value: 'testimonials' },
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }

  async showHealthMenu(): Promise<void> {
    this.currentFlow = 'health';
    const msg = await this.translateMessage(
      `**Health Information Center** ❤️\n\n` +
      `I'm here to help answer your health-related questions. Feel free to ask me anything about:\n\n` +
      `• Common health conditions\n` +
      `• Symptoms and their management\n` +
      `• Preventive care tips\n` +
      `• Nutrition and wellness\n` +
      `• Exercise and fitness\n` +
      `• General medical information\n\n` +
      `Just type your question below and I'll provide helpful information!\n\n` +
      `*⚠️ Important: This information is for educational purposes only. Always consult qualified healthcare professionals for medical advice, diagnosis, or treatment.*`
    );
    this.addBotMessage(msg, [
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
  }



  handleBackNavigation(): void {
    if (this.previousFlow.length > 0) {
      const prevFlow = this.previousFlow.pop()!;

      if (prevFlow === 'student') {
        this.currentFlow = 'student';
        this.showStudentMenu();
      } else if (prevFlow === 'partner') {
        this.currentFlow = 'partner';
        this.showPartnerInfo();
      } else if (prevFlow === 'guest') {
        this.currentFlow = 'guest';
        this.showGuestMenu();
      } else if (prevFlow === 'userType') {
        this.currentFlow = 'userType';
        this.showUserTypeSelection();
      }
    } else {
      this.handleMainMenuNavigation();
    }
  }

  handleMainMenuNavigation(): void {
    this.previousFlow = [];
    this.currentFlow = 'userType';
    this.showUserTypeSelection();
  }

  async handleGeneralInput(input: string): Promise<void> {
    const msg = await this.translateMessage(
      `I understand you're interested in "${input}". Let me help you find the right information.\n\n` +
      `Please use the menu options below to navigate to specific topics:`
    );
    this.addBotMessage(msg, [
      { label: '📚 Course Information', value: 'curriculum' },
      { label: '💰 Pricing Details', value: 'pricing' },
      { label: '❤️ Health Queries', value: 'health' },
      { label: '⬅️ Back to Previous Menu', value: 'back' },
      { label: '🏠 Back to Main Menu', value: 'mainMenu' }
    ]);
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
    if (option.icon) return option.icon;
    // hardcoded labels embed the emoji at the start; use Unicode-aware slice
    const chars = [...option.label];
    return chars.slice(0, 1).join('');
  }

  getOptionLabel(option: Option): string {
    if (option.icon) return option.label;
    // strip the leading emoji character from hardcoded labels
    const chars = [...option.label];
    const rest = chars.slice(1).join('').trimStart();
    return rest || option.label;
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
        this.translateMessage("I didn't hear anything. Please try again.")
          .then(msg => this.addBotMessage(msg));
      } else if (event.error === 'not-allowed') {
        this.translateMessage('Microphone access is required for voice commands. Please enable it in your browser settings.')
          .then(msg => this.addBotMessage(msg));
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
      this.translateMessage("Sorry, your browser doesn't support voice commands.")
        .then(msg => this.addBotMessage(msg));
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

    // Strip emoji and markdown before speaking
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Delay slightly to avoid "interrupted" error
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = this.userData.language || 'en';
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

  // Override addBotMessage to include speech
  addBotMessage(text: string, options: Option[] | null = null, resTime: number | null = null): void {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    console.log(this.topic);
    this.messages.push({
      type: 'bot',
      text,
      options: options || undefined,
      timestamp,
      senderName: this.userData.name,
      topic: this.topic,
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
    this.addBotMessage('thinking');

    try {
      const start = Date.now();
      const healthAdvice = await this.openAIService.getHealthAdviceFromAI(
        query,
        this.userData.language || 'en'
      );
      const end = Date.now();
      const responseTime = parseFloat(((end - start) / 1000).toFixed(2));
      this.messages.pop();

      const disclaimer = await this.translateMessage(
        `⚠️ **Important Disclaimer:** This information is for educational purposes only and should not replace professional medical advice. ` +
        `Always consult with qualified healthcare professionals for personalized medical guidance.`
      );

      this.addBotMessage(`${healthAdvice}\n\n${disclaimer}`, [
        { label: '❤️ Ask Another Health Question', value: 'health' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ], responseTime);

      if (this.voiceEnabled && this.browserSupportsVoice) {
        this.speak(healthAdvice + ". Important: This information is for educational purposes only. Always consult with qualified healthcare professionals for personalized medical guidance.");
      }
    } catch (error) {
      this.messages.pop();
      const errMsg = await this.translateMessage(
        `I apologize, but I'm having trouble processing your health question right now. ` +
        `Please try again or consult with a healthcare professional directly.`
      );
      this.addBotMessage(errMsg, [
        { label: '🔄 Try Again', value: 'health' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]);
    }
  }
removeEmojis(text: string): string {
return text
    // Remove emojis and invisible emoji-related characters
    .replace(
      /([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|\uFE0F|\u200D)/g,
      ''
    )
    // Replace all types of spaces and collapse multiple into one
    .replace(/[\s\u00A0]+/g, ' ')
    // Trim leading/trailing spaces
    .trim();
}
  saveQueryHistory() {
    if (this.messages.length >= 6) {

      const queryText = this.messages[this.messages.length - 2];
      const responseText = this.messages[this.messages.length - 1] || '';
      
      const queryDto = {
        userId: this.userId,
        queryText: queryText.text,
        responseText: responseText.text,
        responseTime: responseText.responseTime,       // If available
        topic: this.removeEmojis(responseText.topic),
        status: responseText.text ? 'Answered' : 'Unanswered'
      };
      this.http.post(`${this.baseUrl}user/SaveQueryHistory`, queryDto).subscribe({
        next: res => console.log('Saved:', res),
        error: err => console.error('Save failed:', err)
      });

    }
  }
}
