export default function ErrorFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="bg-[#ff4757] p-3 rounded-xl text-white mb-4 shadow-lg shadow-red-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        The page ran into an unexpected error. Try reloading — if it keeps happening, contact support.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-5 py-2.5 rounded-lg bg-[#ff4757] text-white font-medium hover:bg-red-600 transition-colors"
      >
        Reload page
      </button>
    </div>
  );
}
