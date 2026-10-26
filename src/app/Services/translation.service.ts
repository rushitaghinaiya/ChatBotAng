import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../constants/environment';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface TranslationApiResponse {
  success: boolean;
  data?: { translatedText?: string };
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly translateUrl = `${environment.API_BASE_URL}Translation/translate`;
  private translationCache = new Map<string, string>();

  constructor(private http: HttpClient) {}

  translateText(text: string, targetLanguage: string): Observable<string> {
    if (!environment.enableTranslation) return of(text);
    if (!targetLanguage || targetLanguage === 'en') return of(text);

    const cacheKey = `${text}-${targetLanguage}`;
    if (this.translationCache.has(cacheKey)) {
      return of(this.translationCache.get(cacheKey)!);
    }

    const params = new HttpParams().set('text', text).set('target', targetLanguage);

    return this.http.post<TranslationApiResponse>(this.translateUrl, null, { params }).pipe(
      map(response => {
        const translated = response?.data?.translatedText?.trim() || text;
        this.translationCache.set(cacheKey, translated);
        return translated;
      }),
      catchError(() => of(text))
    );
  }
}
