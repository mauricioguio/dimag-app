import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { from } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

const CLOUD_NAME = 'drp8ofkl4';
const UPLOAD_PRESET = 'guiio-producs';
const MAX_WIDTH = 1200;
const QUALITY = 0.85;
const MAX_WIDTH_GALLERY = 2400;
const QUALITY_GALLERY = 0.92;

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private readonly http = inject(HttpClient);

  private toWebP(file: File, maxWidth = MAX_WIDTH, quality = QUALITY): Promise<File> {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          blob => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })),
          'image/webp',
          quality,
        );
      };
      img.src = url;
    });
  }

  uploadRaw(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', UPLOAD_PRESET);
    return this.http.post<{ secure_url: string }>(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      form,
    ).pipe(map(res => res.secure_url));
  }

  uploadGallery(file: File) {
    return from(this.toWebP(file, MAX_WIDTH_GALLERY, QUALITY_GALLERY)).pipe(
      switchMap(webp => {
        const form = new FormData();
        form.append('file', webp);
        form.append('upload_preset', UPLOAD_PRESET);
        return this.http.post<{ secure_url: string }>(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          form,
        );
      }),
      map(res => res.secure_url),
    );
  }

  upload(file: File) {
    return from(this.toWebP(file)).pipe(
      switchMap(webp => {
        const form = new FormData();
        form.append('file', webp);
        form.append('upload_preset', UPLOAD_PRESET);
        return this.http.post<{ secure_url: string }>(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          form,
        );
      }),
      map(res => res.secure_url),
    );
  }
}

