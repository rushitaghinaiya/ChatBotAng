import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../constants/environment';

@Injectable({
  providedIn: 'root'
})
export class OpenAIService {
  private apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(private http: HttpClient) {}

  async getHealthAdviceFromAI(query: string): Promise<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${environment.openAiKey}`
    });

    const body = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `You are a medical assistant. 
⚠️ Only answer questions related to health, medicine, fitness, nutrition, wellness, or caregiving.  
❌ If the user asks anything not related to health, politely decline by saying: 
"I am specialized in caregiving and healthcare-related topics, and cannot provide information on this query."  
Always provide safe, factual, knowledge-based responses. 
Do not provide legal, financial, or unrelated advice.` },
        { role: 'user', content: query }
      ],
      max_tokens: 133,
      temperature: 0.7
    };

    try {
      const response: any = await firstValueFrom(this.http.post(this.apiUrl, body, { headers }));
      return response.choices[0]?.message?.content || 'Sorry, I couldn’t generate a response.';
    } catch (error) {
      console.error('OpenAI API error:', error);
      return 'There was an error contacting the AI service.';
    }
  }
}
