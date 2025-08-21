import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TranslateService {
  private apiKey = 'YOUR_GOOGLE_TRANSLATE_API_KEY';
  private baseUrl = 'https://translation.googleapis.com/language/translate/v2';

  constructor(private http: HttpClient) {}

  // 🌍 Detect Language
  detectLanguage(text: string): Observable<any> {
    const params = new HttpParams()
      .set('key', this.apiKey)
      .set('q', text);

    return this.http.post<any>(
      `${this.baseUrl}/detect`,
      {},
      { params }
    );
  }

  // 🔄 Translate Text
  translateText(text: string, targetLang: string): Observable<any> {
    const params = new HttpParams()
      .set('key', this.apiKey)
      .set('q', text)
      .set('target', targetLang);

    return this.http.post<any>(
      this.baseUrl,
      {},
      { params }
    );
  }
}
