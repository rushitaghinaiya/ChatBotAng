// src/app/services/who-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WhoApiService {
  private baseUrl = 'https://localhost:7215/v1/who'; // ✅ Your .NET backend URL

  constructor(private http: HttpClient) {}

  getLifeExpectancy(countryCode: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/GetLifeExpectancy/life-expectancy/${countryCode}`);
  }

  getHealthTopics(search: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/GetTopics/topics?search=${search}`);
  }

  getTopicNews(topicId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/GetTopicNews/topic-news/${topicId}`);
  }

  getTopicStats(topicId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/GetTopicStats/topic-stats/${topicId}`);
  }

  getTopicFacts(topicId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/GetTopicFacts/topic-facts/${topicId}`);
  }
}
