import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})


export class GenAPI{
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: 'YOUR_API_KEY' });
  }

 async ask(question: string): Promise<string> {
   const resp = await this.ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents:  `
      You are a healthcare assistant. 
      Answer only health, wellness, medicine, fitness, or nutrition related questions.
      If the user asks about anything unrelated, politely respond: 
      "I can only answer health-related questions."
      
      User question: ${question}
    `
    });
  // Ensure always returning a string
  return resp.text ?? "";
}
}

