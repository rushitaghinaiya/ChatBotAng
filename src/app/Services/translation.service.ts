import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../constants/environment';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translationCache = new Map<string, string>();
  
  constructor(private http: HttpClient) {}

  translateText(text: string, targetLanguage: string): Observable<string> {
    // Check cache first
    console.log(text);
    console.log(targetLanguage);
    const cacheKey = `${text}-${targetLanguage}`;
    if (this.translationCache.has(cacheKey)) {
      return of(this.translationCache.get(cacheKey)!);
    }

    // If not in cache, call Google Translate API
    const params = {
      q: text,
      target: targetLanguage,
      key: environment.googleTranslateApiKey
    };

    return this.http.post<any>(environment.googleTranslateApiUrl, null, { params }).pipe(
      map(response => {
        const translatedText = response.data.translations[0].translatedText;
        // Cache the translation
        this.translationCache.set(cacheKey, translatedText);
        return translatedText;
      }),
      catchError(error => {
        console.error('Translation error', error);
        // Fallback to original text if translation fails
        return of(text);
      })
    );
  }

  // Get supported languages
  getSupportedLanguages() {
    return environment.supportedLanguages;
  }
}