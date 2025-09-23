import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../constants/environment';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyBuEePDrPjwkBLldTvvfJ6kECQYMzLA4m0`;

  constructor(private http: HttpClient) {}

  async getHealthAdviceFromGemini(query: string): Promise<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = {
      contents: [
        {
          parts: [
            { text: 'You are a helpful medical assistant providing health advice.' },
            { text: query }
          ]
        }
      ]
    };

    try {
      const response: any = await firstValueFrom(this.http.post(this.apiUrl, body, { headers }));
      debugger;
      // Gemini puts text under candidates[0].content.parts[0].text
      return response.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I couldn’t generate a response.';
    } catch (error) {
      console.error('Gemini API error:', error);
      return 'There was an error contacting the AI service.';
    }
  }
}
