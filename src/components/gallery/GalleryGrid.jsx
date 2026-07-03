import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

export function GalleryGrid({ images, compact = false }) {
  if (!images.length) {
    return null;
  }

  return (
    <PhotoProvider maskOpacity={0.92}>
      <div className={compact ? 'columns-2 gap-3 md:columns-3' : 'columns-1 gap-4 sm:columns-2 lg:columns-3'}>
        {images.map((image, index) => (
          <PhotoView key={image.id} src={image.src}>
            <button
              className="group mb-4 block w-full cursor-zoom-in overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ruby)]"
              type="button"
              aria-label={`Abrir imagen ${index + 1} de la galeria`}
            >
              <img
                className="w-full object-cover opacity-95 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-100"
                src={image.src}
                alt={image.alt}
                loading={index < 2 ? 'eager' : 'lazy'}
              />
            </button>
          </PhotoView>
        ))}
      </div>
    </PhotoProvider>
  );
}
