// icare-chatbot.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { OpenAIService } from '../Services/open-ai.service';
import { TranslationService } from '../Services/translation.service';
import { Observable, firstValueFrom } from 'rxjs';

interface Message {
  type: 'bot' | 'user';
  text: string;
  options?: Option[];
  timestamp: string;
}

interface Option {
  label: string;
  value: string;
  icon?: string;
  code?: string;
}

interface UserData {
  name: string;
  contact: string;
  userType: string;
  language: string;
}

@Component({
  selector: 'app-icare-chatbot',
  imports:[ CommonModule,FormsModule,HttpClientModule],
  templateUrl: './icare-chatbot.component.html',
  styleUrls: ['./icare-chatbot.component.css']
})
export class ICareChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  messages: Message[] = [];
  userInput: string = '';
  currentFlow: string = 'welcome';
  userData: UserData = {
    name: '',
    contact: '',
    userType: '',
    language: ''
  };
  awaitingInput: string | null = null;
  previousFlow: string[] = [];

  constructor(private http: HttpClient, private openAIService: OpenAIService, private translationService: TranslationService) {}

  ngOnInit() {
    this.showLanguageSelection();
  }

  getLanguages(): Observable<{ success: boolean; data: any[] }> {
    return this.http.get<{ success: boolean; data: any[] }>(`https://chat.icare.life/api/v1/Setting/get_languages`);
  }

  async showLanguageSelection(): Promise<void> {
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
        this.showNamePrompt();
      }
    } catch {
      this.showNamePrompt();
    }
  }

  private async showNamePrompt(): Promise<void> {
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

  // Translates text to the user's selected language before displaying it.
  // Returns original text immediately if translation is disabled or language is English.
  private async translateMessage(text: string): Promise<string> {
    return firstValueFrom(
      this.translationService.translateText(text, this.userData.language || 'en')
    );
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  addBotMessage(text: string, options: Option[] | null = null): void {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.messages.push({
      type: 'bot',
      text,
      options: options || undefined,
      timestamp
    });
  }

  addUserMessage(text: string): void {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.messages.push({
      type: 'user',
      text,
      timestamp
    });
  }

  async handleUserInput(input: string): Promise<void> {
    this.addUserMessage(input);

    if (this.awaitingInput === 'name') {
      this.userData.name = input;
      this.awaitingInput = 'contact';
      const msg = await this.translateMessage(
        `Nice to meet you, ${input}! 😊\n\nCould you please share your phone number so we can keep you updated about our programs?`
      );
      this.addBotMessage(msg);
    } else if (this.awaitingInput === 'contact') {
      this.userData.contact = input;
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
  }

  handleOptionClick(option: Option): void {
    this.addUserMessage(option.label);

    if (option.value.startsWith('langs_')) {
      this.userData.language = option.code || 'en';
      this.showNamePrompt();
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
      `Thank you! I've saved your contact information.\n\n` +
      `To provide you with the best information, please tell me - are you a:`
    );
    this.addBotMessage(msg, [
      { label: '🎓 Student', value: 'student', icon: '🎓' },
      { label: '🤝 Partner', value: 'partner', icon: '🤝' },
      { label: '👋 Guest', value: 'guest', icon: '👋' }
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

  async handleHealthQuery(query: string): Promise<void> {
    const thinking = await this.translateMessage('🤔 Let me look that up for you...');
    this.addBotMessage(thinking);

    try {
      const healthAdvice = await this.openAIService.getHealthAdviceFromAI(
        query,
        this.userData.language || 'en'
      );

      this.messages.pop();

      const disclaimer = await this.translateMessage(
        `⚠️ **Important Disclaimer:** This information is for educational purposes only and should not replace professional medical advice. ` +
        `Always consult with qualified healthcare professionals for personalized medical guidance.`
      );

      this.addBotMessage(`${healthAdvice}\n\n${disclaimer}`, [
        { label: '❤️ Ask Another Health Question', value: 'health' },
        { label: '⬅️ Back to Previous Menu', value: 'back' },
        { label: '🏠 Back to Main Menu', value: 'mainMenu' }
      ]);
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

  async getHealthAdviceFromAI(query: string): Promise<string> {
    // In production, replace this with actual OpenAI API call:
    // return this.http.post('https://api.openai.com/v1/chat/completions', {...}).toPromise();
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock responses
    const mockResponses: any = {
      'headache': `Based on your query about headaches, here's some helpful information:\n\n**Common Causes:**\n• Stress and tension\n• Dehydration\n• Poor posture\n• Eye strain\n• Lack of sleep\n\n**Relief Methods:**\n• Stay hydrated with water\n• Rest in a quiet, dark room\n• Apply cold compress to forehead\n• Practice relaxation techniques\n• Gentle neck stretches\n\n**When to Seek Medical Help:**\n• Sudden, severe headache\n• Headache with fever, stiff neck, or confusion\n• Persistent headaches that worsen\n• Headaches after a head injury`,
      
      'fever': `Here's information about fever management:\n\n**What is Fever:**\nA body temperature above 98.6°F (37°C) is considered elevated. Fever is often a sign that your body is fighting an infection.\n\n**Management Tips:**\n• Rest and stay hydrated\n• Take temperature regularly\n• Wear light clothing\n• Use fever-reducing medications as directed\n• Take lukewarm baths\n\n**Seek Medical Care If:**\n• Temperature exceeds 103°F (39.4°C)\n• Fever lasts more than 3 days\n• Accompanied by severe symptoms\n• In infants under 3 months`,
      
      'default': `I understand you're asking about a health topic. While I can provide general health information, it's important to remember that:\n\n• This information is educational only\n• Individual health needs vary\n• Professional medical advice is essential for diagnosis and treatment\n\n**General Health Tips:**\n• Maintain a balanced diet\n• Exercise regularly\n• Get adequate sleep (7-9 hours)\n• Stay hydrated\n• Manage stress\n• Regular health check-ups\n\nFor specific concerns, please consult with a qualified healthcare provider who can assess your individual situation.`
    };
    
    const lowerQuery = query.toLowerCase();
    for (const [keyword, response] of Object.entries(mockResponses)) {
      if (lowerQuery.includes(keyword)) {
        return response as string;
      }
    }
    
    return mockResponses.default;
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
    return option.icon || option.label.slice(0, 2);
  }

  getOptionLabel(option: Option): string {
    return option.label.length > 2 ? option.label.slice(2) : option.label;
  }
}
