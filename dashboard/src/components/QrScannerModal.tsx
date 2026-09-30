import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { useTranslation } from 'react-i18next';
import { X, Camera } from 'lucide-react';

export default function QrScannerModal({
  title,
  hint,
  onScan,
  onClose,
}: {
  title?: string;
  hint?: string;
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('qrScanner.defaultTitle');
  const resolvedHint = hint ?? t('qrScanner.defaultHint');
  const videoRef = useRef<HTMLVideoElement>(null);
  // A ref keeps the scanner's decode callback pointed at the latest onScan
  // without needing to tear down and recreate the camera stream on every render.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        scanner.stop();
        onScanRef.current(result.data);
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: 'environment',
      }
    );

    scanner.start().catch(() => {
      setError(t('qrScanner.cameraError'));
    });

    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl overflow-hidden max-w-sm w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Camera size={18} /> {resolvedTitle}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>
        <div className="relative aspect-square bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        </div>
        {error ? (
          <p className="text-sm text-red-500 p-4">{error}</p>
        ) : (
          <p className="text-xs text-gray-400 p-4 text-center">{resolvedHint}</p>
        )}
      </div>
    </div>
  );
}
