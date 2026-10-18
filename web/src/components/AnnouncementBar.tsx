// The red scrolling notice above the site nav (see .beta-marquee in
// index.css). Its direction follows the nearest `dir`, so the admin preview
// can show any locale's direction regardless of the admin UI's own.
export default function AnnouncementBar({ message }: { message: string }) {
  return (
    <div className="beta-banner bg-red-600 text-white text-sm font-semibold overflow-hidden" role="status">
      <span className="beta-marquee">{message}</span>
    </div>
  );
}
