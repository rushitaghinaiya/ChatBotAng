// src/app/Services/language.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private translations: any = {};

  constructor(private http: HttpClient) {}

  loadTranslations(): Observable<any> {
    return this.http.get('assets/translations.json');
  }

  setTranslations(data: any) {
    this.translations = data;
  }

  getTranslations() {
    return this.translations;
  }
}
