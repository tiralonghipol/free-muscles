import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Exercise } from '../data/exercises';

// free-exercise-db ships a start and an end photo per exercise; alternating them reads like a GIF.
const FRAME_MS = 1100;
const FRAME_NAMES = ['Start', 'End'];

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function useFrames(count: number, playing: boolean) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!playing || count < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % count), FRAME_MS);
    return () => clearInterval(t);
  }, [playing, count]);
  return [frame, setFrame] as const;
}

export function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  const images = exercise.images.slice(0, 2);
  // Still by default; opening the lightbox starts the animation and closing it stops it again.
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useFrames(images.length, playing);
  const [zoomed, setZoomed] = useState(false);

  const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} exercise proper form`)}`;

  if (images.length === 0) {
    return (
      <a className="video-link" href={videoUrl} target="_blank" rel="noreferrer">▶ Watch on YouTube</a>
    );
  }

  const step = (dir: 1 | -1) => {
    setPlaying(false);
    setFrame((f) => (f + dir + images.length) % images.length);
  };

  return (
    <div className="media">
      <button className="media-stage" onClick={() => { setZoomed(true); setPlaying(!prefersReducedMotion()); }} aria-label="Enlarge pictures">
        <Frames images={images} frame={frame} alt={exercise.name} />
        <span className="media-badge">{FRAME_NAMES[frame]}</span>
        <span className="media-zoom" aria-hidden>⤢</span>
      </button>
      <div className="media-controls">
        {images.length > 1 && (
          <>
            <button className="icon-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? '❚❚' : '▶'}
            </button>
            <FrameDots count={images.length} frame={frame} onPick={(i) => { setPlaying(false); setFrame(i); }} />
          </>
        )}
        <a className="video-link" href={videoUrl} target="_blank" rel="noreferrer">▶ Watch on YouTube</a>
      </div>

      {zoomed && createPortal(
        <Lightbox
          title={exercise.name}
          images={images}
          frame={frame}
          playing={playing}
          onTogglePlay={() => setPlaying((p) => !p)}
          onStep={step}
          onPick={(i) => { setPlaying(false); setFrame(i); }}
          onClose={() => { setZoomed(false); setPlaying(false); }}
        />,
        document.body,
      )}
    </div>
  );
}

// Both frames stay mounted and crossfade, so switching never waits on the network.
function Frames({ images, frame, alt }: { images: string[]; frame: number; alt: string }) {
  return (
    <span className="frames">
      {images.map((src, i) => (
        <img key={src} src={src} alt={`${alt} – ${FRAME_NAMES[i]} position`} className={i === frame ? 'shown' : ''} />
      ))}
    </span>
  );
}

function FrameDots({ count, frame, onPick }: { count: number; frame: number; onPick: (i: number) => void }) {
  return (
    <span className="frame-dots">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} className={i === frame ? 'active' : ''} onClick={() => onPick(i)}>
          {FRAME_NAMES[i]}
        </button>
      ))}
    </span>
  );
}

interface LightboxProps {
  title: string;
  images: string[];
  frame: number;
  playing: boolean;
  onTogglePlay: () => void;
  onStep: (dir: 1 | -1) => void;
  onPick: (i: number) => void;
  onClose: () => void;
}

function Lightbox({ title, images, frame, playing, onTogglePlay, onStep, onPick, onClose }: LightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'ArrowLeft') onStep(-1);
      else if (e.key === ' ') { e.preventDefault(); onTogglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onStep, onTogglePlay]);

  // Horizontal swipe steps between frames.
  const [touchX, setTouchX] = useState<number | null>(null);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="lightbox-head" onClick={(e) => e.stopPropagation()}>
        <span>{title}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div
        className="lightbox-stage"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 40) onStep(dx < 0 ? 1 : -1);
          setTouchX(null);
        }}
      >
        <Frames images={images} frame={frame} alt={title} />
      </div>
      {images.length > 1 && (
        <div className="lightbox-controls" onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn" onClick={() => onStep(-1)} aria-label="Previous">‹</button>
          <button className="icon-btn" onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
          <FrameDots count={images.length} frame={frame} onPick={onPick} />
          <button className="icon-btn" onClick={() => onStep(1)} aria-label="Next">›</button>
        </div>
      )}
    </div>
  );
}
