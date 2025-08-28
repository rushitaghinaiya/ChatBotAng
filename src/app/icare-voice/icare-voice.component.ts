// icare-chatbot.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { OpenAIService } from '../Services/open-ai.service';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { environment } from '../constants/environment';
// import { DeviceDetectorService } from 'ngx-device-detector';

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


  constructor(private http: HttpClient, private openAIService: OpenAIService, private cdr: ChangeDetectorRef, private ngZone: NgZone) {

    this.speechSynthesis = window.speechSynthesis;
    // Check browser support for speech recognition
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      this.browserSupportsVoice = true;
      this.initializeSpeechRecognition(SpeechRecognitionAPI);
    }

  }

  ngOnInit() {
    // const deviceInfo = this.deviceService.getDeviceInfo();
    // console.log('Device Info:', deviceInfo);
    this.botSession.startTime = new Date().toISOString();// Record start time
    this.addBotMessage(
      "Welcome to iCare Life!\n\n" +
      "**Empowering YOU with skill-training for a Brighter Future!**\n\n" +
      "I'm your virtual assistant, here to help you explore our integrated platform for caregiver training and certification. " +
      "Let's start by getting to know you better.\n\n" +
      "What's your name?"
    );
    this.awaitingInput = 'name';

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

 handleUserInput(input: string): void {
  this.addUserMessage(input.trim());

  if (this.awaitingInput === 'name') {
    // Name validation: only letters and at least 2 characters
    const nameRegex = /^[a-zA-Z ]{2,}$/;
    if (!nameRegex.test(input)) {
      this.addBotMessage("Please enter a valid name (only alphabets, minimum 2 characters).");
      return;
    }

    this.userData.name = input;
    this.awaitingInput = 'mobile';
    this.addBotMessage(`Nice to meet you, ${input}! 😊\n\nCould you please share your phone number so we can keep you updated about our programs?`);

  } else if (this.awaitingInput === 'mobile') {
    // Mobile validation: 10 digits only
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(input)) {
      this.addBotMessage("Please enter a valid 10-digit mobile number (numbers only).");
      return;
    }

    this.userData.mobile = input;
    this.awaitingInput = null;
    this.currentFlow = 'userType';
    this.showUserTypeSelection();

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
              this.isLoggedIn = true;
              const { user, accessToken, refreshToken, tokenExpiration, tokenType } = res.data;

              // ✅ Save required data to localStorage
              localStorage.setItem('user', JSON.stringify(user));
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', refreshToken);
              localStorage.setItem('tokenExpiration', tokenExpiration);
              localStorage.setItem('tokenType', tokenType);

              this.userId = user.id;

              console.log('User and tokens stored in localStorage');
            }
          },
          error: (err) => console.error('Save failed:', err)
        });
    }
  }

  handleOptionClick(option: Option): void {
    this.addUserMessage(option.label);
    this.topic = option.label;
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

  showUserTypeSelection(): void {
    this.addBotMessage(
      `Thank you! I've saved your mobile information.\n\n` +
      `To provide you with the best information, please tell me - are you a:`,
      [
        { label: '🎓 Student', value: 'student', icon: '🎓' },
        { label: '🤝 Partner', value: 'partner', icon: '🤝' },
        { label: '👋 Guest', value: 'guest', icon: '👋' }
      ]
    );
  }

  showStudentMenu(): void {
    this.addBotMessage(
      `Welcome, future caregiver! 🌟\n\n` +
      `I'm excited to help you explore our comprehensive training programs. What would you like to know about?`,
      [
        { label: '📚 Know More About iCare', value: 'knowMore' },
        { label: '🎯 View Curriculum & Languages', value: 'curriculum' },
        { label: '💼 Caregiving Modules', value: 'caregiving' },
        { label: '💰 Pricing & Trial Options', value: 'pricing' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showAboutICare(): void {
    this.addBotMessage(
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
      `• Expert mentorship and support`,
      [
        { label: '🎯 View Our Courses', value: 'curriculum' },
        { label: '💰 See Pricing', value: 'pricing' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showLanguageOptions(): void {
    this.addBotMessage(
      `**Choose Your Language Track** 🌐\n\n` +
      `We offer our caregiving curriculum in multiple language families to serve our global community:`,
      [
        { label: '🇩🇪 Germanic Languages', value: 'lang_germanic' },
        { label: '🇫🇷 Romance Languages', value: 'lang_romance' },
        { label: '🇷🇺 Slavic Languages', value: 'lang_slavic' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showCourseDetails(language: string): void {
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

    this.addBotMessage(
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
      `• Certification upon completion`,
      [
        { label: '💰 View Pricing', value: 'pricing' },
        { label: '🎯 Other Languages', value: 'curriculum' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showCaregivingModules(): void {
    this.addBotMessage(
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
      `• Career advancement strategies`,
      [
        { label: '💰 See Pricing', value: 'pricing' },
        { label: '🎯 Choose Language', value: 'curriculum' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showPricingInfo(): void {
    this.addBotMessage(
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
      `**Payment Methods:** Credit/Debit cards, PayPal, Bank transfer`,
      [
        { label: '🚀 Start 3-Day Trial', value: 'trial' },
        { label: '📚 View Courses', value: 'curriculum' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showPartnerInfo(): void {
    this.addBotMessage(
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
      `📧 mobile us at partners@icare.life for detailed information`,
      [
        { label: '📊 Request Partnership Details', value: 'partnerDetails' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showGuestMenu(): void {
    this.addBotMessage(
      `**Welcome, Guest!** 👋\n\n` +
      `I'm here to help you explore what iCare Life has to offer. What would you like to know about?`,
      [
        { label: '⭐ Read Testimonials', value: 'testimonials' },
        { label: '🎯 Benefits of iCare', value: 'benefits' },
        { label: '❤️ General Health Queries', value: 'health' },
        { label: '📚 Explore Courses', value: 'curriculum' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showTestimonials(): void {
    this.addBotMessage(
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
      `**Join thousands of successful caregivers worldwide!**`,
      [
        { label: '🎯 Learn About Benefits', value: 'benefits' },
        { label: '💰 View Pricing', value: 'pricing' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showBenefits(): void {
    this.addBotMessage(
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
      `• Meaningful work with purpose`,
      [
        { label: '📚 Explore Courses', value: 'curriculum' },
        { label: '⭐ Read Testimonials', value: 'testimonials' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
  }

  showHealthMenu(): void {
    this.currentFlow = 'health';
    this.addBotMessage(
      `**Health Information Center** ❤️\n\n` +
      `I'm here to help answer your health-related questions. Feel free to ask me anything about:\n\n` +
      `• Common health conditions\n` +
      `• Symptoms and their management\n` +
      `• Preventive care tips\n` +
      `• Nutrition and wellness\n` +
      `• Exercise and fitness\n` +
      `• General medical information\n\n` +
      `Just type your question below and I'll provide helpful information!\n\n` +
      `*⚠️ Important: This information is for educational purposes only. Always consult qualified healthcare professionals for medical advice, diagnosis, or treatment.*`,
      [
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
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

  handleGeneralInput(input: string): void {
    this.addBotMessage(
      `I understand you're interested in "${input}". Let me help you find the right information.\n\n` +
      `Please use the menu options below to navigate to specific topics:`,
      [
        { label: '📚 Course Information', value: 'curriculum' },
        { label: '💰 Pricing Details', value: 'pricing' },
        { label: '❤️ Health Queries', value: 'health' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]
    );
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
    return option.label.length > 2 ? option.label.slice(2) : option.label;
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

    if(!environment.isSpeak) return;
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
    // Show typing indicator
    this.addBotMessage('thinking');

    try {
      const start = Date.now();
      // Simulate API call
      const healthAdvice = await this.openAIService.getHealthAdviceFromAI(query);
      const end = Date.now();
      const responseTime = parseFloat(((end - start) / 1000).toFixed(2));
      // Remove typing indicator
      this.messages.pop();
      console.log(responseTime);
      const response = `${healthAdvice}\n\n` +
        `⚠️ **Important Disclaimer:** This information is for educational purposes only and should not replace professional medical advice. ` +
        `Always consult with qualified healthcare professionals for personalized medical guidance.`;

      this.addBotMessage(
        response,
        [
          { label: '❤️ Ask Another Health Question', value: 'health' },
          { label: '⬅️ Back to Previous Menu', value: 'back' },
          { label: '🏠 Back to Main Menu', value: 'mainMenu' }
        ], responseTime
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