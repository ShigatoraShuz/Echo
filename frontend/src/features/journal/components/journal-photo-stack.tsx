import journalLandscape from "../../../../assets/growth-doorway-hill.png";
import { JournalPolaroid } from "./journal-polaroid";

export function JournalPhotoStack({ images }: { images: Array<{ id: string; url: string }> }) {
  if (images.length === 0) return <div className="journal-photo-gallery" aria-label="Reflection illustration"><JournalPolaroid src={journalLandscape} alt="Illustration of a doorway on a hillside" caption="Illustration · no photos added" /></div>;

  return (
    <div className="journal-photo-gallery" aria-label="Reflection photos">
      {images.slice(0, 5).map((photo, index) => (
        <JournalPolaroid
          key={photo.id}
          src={photo.url}
          alt={`Photo ${index + 1} from this reflection`}
          caption={`Memory ${index + 1}`}
          index={index}
        />
      ))}
    </div>
  );
}
