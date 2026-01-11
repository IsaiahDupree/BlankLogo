'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Film } from 'lucide-react';

interface VideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
}

export function VideoThumbnail({ src, alt = 'Video thumbnail', className = '' }: VideoThumbnailProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    
    video.onloadeddata = () => {
      // Seek to 1 second or 10% of the video, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setThumbnail(dataUrl);
        }
      } catch (e) {
        console.error('Error generating thumbnail:', e);
        setError(true);
      }
      setLoading(false);
    };

    video.onerror = () => {
      console.error('Error loading video for thumbnail');
      setError(true);
      setLoading(false);
    };

    video.src = src;

    return () => {
      video.src = '';
    };
  }, [src]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 rounded-lg ${className}`}>
        <div className="animate-pulse">
          <Film className="w-8 h-8 text-gray-600" />
        </div>
      </div>
    );
  }

  if (error || !thumbnail) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 rounded-lg ${className}`}>
        <Film className="w-8 h-8 text-gray-600" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <img 
        src={thumbnail} 
        alt={alt}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
        <Play className="w-8 h-8 text-white" />
      </div>
    </div>
  );
}
