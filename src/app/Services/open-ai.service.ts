import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../constants/environment';

@Injectable({
  providedIn: 'root'
})
export class OpenAIService {
  private readonly healthQuestionUrl =
    `${environment.API_BASE_URL}MedicareKnowledgeBase/file-qna/${environment.knowledgeBaseCompanyCode}`;

  constructor(private http: HttpClient) {}

  async getHealthAdviceFromAI(query: string, language = 'en'): Promise<string> {
    const params = new HttpParams()
      .set('question', query)
      .set('language', language || 'en');

    try {
      const response = await firstValueFrom(this.http.post<KnowledgeBaseResponse>(
        this.healthQuestionUrl,
        null,
        { params }
      ));
      const answer = response?.data?.answer?.trim();

      if (!response?.success || !answer) {
        throw new Error(response?.message || 'The knowledge base returned an empty answer.');
      }

      return answer;
    } catch (error) {
      console.error('Health knowledge base request failed:', error);
      return 'There was an error contacting the AI service.';
    }
  }
}

interface KnowledgeBaseResponse {
  success: boolean;
  message?: string;
  data?: {
    answer?: string;
  };
}
