import { inject, PLATFORM_ID } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpInterceptorFn
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

export const tokenInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const router = inject(Router);

  const token = localStorage.getItem("accessToken");

  const isInternalRequest = !req.url.startsWith('https://api.openai.com');
  const isPerformRequest = req.url.includes('performid');

  let newReq = req;

  // ✅ Add token only if it's an internal request and doesn't include 'performid'
  if (token && isInternalRequest && !isPerformRequest) {
    newReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(newReq).pipe(
    // catchError(err => {
    //   if (err.status === 401) {
    //     console.warn('⛔ Token expired or unauthorized. Redirecting to login...');
    //     localStorage.removeItem('accessToken'); // Optional cleanup
    //     router.navigate(['/chatbot']); 
    //   }

    //   return throwError(() => err);
    // })
  );
};
