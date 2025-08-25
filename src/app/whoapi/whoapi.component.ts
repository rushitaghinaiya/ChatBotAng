import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WhoApiService } from '../Services/WhoApiService';

@Component({
  selector: 'app-whoapi',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './whoapi.component.html',
  styleUrls: ['./whoapi.component.css']
})
export class WhoapiComponent {
  // inputs
  country = 'IND';
  search = '';

  // data
  life: any[] = [];
  topics: any[] = [];
  news: any[] = [];
  stats: any[] = [];
  facts: any[] = [];

  // ui state
  loading = false;
  error = '';

  constructor(private who: WhoApiService) {}

  loadLife() {
    this.resetSection('life');
    this.loading = true;
    this.who.getLifeExpectancy(this.country).subscribe({
      next: (res) => { this.life = res?.value ?? []; this.loading = false; },
      error: (e) => { this.error = 'Failed to load life expectancy.'; this.loading = false; }
    });
  }

  searchTopics() {
    this.resetSection('topics');
    if (!this.search.trim()) { return; }
    this.loading = true;
    this.who.getHealthTopics(this.search).subscribe({
      next: (res) => { this.topics = res?.value ?? []; this.loading = false; },
      error: (e) => { this.error = 'Failed to load topics.'; this.loading = false; }
    });
  }

  loadDetails(topic: any) {
    if (!topic?.Id) return;
    this.news = []; this.stats = []; this.facts = [];
    this.loading = true;

    this.who.getTopicNews(topic.Id).subscribe({
      next: (r) => this.news = r?.value ?? [],
      error: () => this.error = 'Failed to load news.'
    });

    this.who.getTopicStats(topic.Id).subscribe({
      next: (r) => this.stats = r?.value ?? [],
      error: () => this.error = 'Failed to load related statistics.'
    });

    this.who.getTopicFacts(topic.Id).subscribe({
      next: (r) => { this.facts = r?.value ?? []; this.loading = false; },
      error: () => { this.error = 'Failed to load fact sheets.'; this.loading = false; }
    });
  }

  trackById = (_: number, item: any) => item?.Id ?? item?.UrlName ?? _;

  private resetSection(which: 'life' | 'topics') {
    this.error = '';
    if (which === 'life') this.life = [];
    if (which === 'topics') { this.topics = []; this.news = []; this.stats = []; this.facts = []; }
  }
}
