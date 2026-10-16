import { Injectable } from '@angular/core';
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
    if (!targetLanguage || targetLanguage === 'en') return of(text);

    const cacheKey = `${text}-${targetLanguage}`;
    if (this.translationCache.has(cacheKey)) {
      return of(this.translationCache.get(cacheKey)!);
    }

    const params = {
      q: text,
      target: targetLanguage,
      key: environment.googleTranslateApiKey
    };

    return this.http.post<any>(environment.googleTranslateApiUrl, null, { params }).pipe(
      map(response => {
        const translatedText = response.data.translations[0].translatedText;
        this.translationCache.set(cacheKey, translatedText);
        return translatedText;
      }),
      catchError(() => of(text))
    );
  }
}
