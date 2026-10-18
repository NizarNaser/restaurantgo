import { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../../lib/brand';
import { pick } from '../../lib/localized';

interface Announcement {
  enabled: boolean;
  message: Record<string, string> | null;
}

const PLATFORM_SEO_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/platform/seo`;

// One request per page load, shared by every public route the visitor
// navigates through (the layout stays mounted, but this survives remounts).
let announcementRequest: Promise<Announcement> | null = null;
function loadAnnouncement(): Promise<Announcement> {
  announcementRequest ??= axios
    .get<{ announcement?: Announcement }>(PLATFORM_SEO_URL)
    .then((res) => res.data.announcement ?? { enabled: true, message: null })
    .catch(() => ({ enabled: true, message: null }));
  return announcementRequest;
}

/**
 * The platform-wide notice bar (set in the company admin → Announcement
 * bar, same setting as the marketing site), shown above every restaurant's
 * public pages. Rendered only once the setting is known, so a bar the admin
 * turned off never flashes. Styles: .beta-banner / .beta-marquee in index.css.
 */
export default function AnnouncementBar() {
  const { t, i18n } = useTranslation();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let active = true;
    loadAnnouncement().then((a) => active && setAnnouncement(a));
    return () => { active = false; };
  }, []);

  if (!announcement?.enabled) return null;

  const message = pick(announcement.message, i18n.resolvedLanguage ?? i18n.language, t('betaBanner.message', { appName: APP_NAME }));

  return (
    <div className="beta-banner bg-red-600 text-white text-sm font-semibold overflow-hidden" role="status">
      <span className="beta-marquee">{message}</span>
    </div>
  );
}
