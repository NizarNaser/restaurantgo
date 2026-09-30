interface SectionTab {
  key: string;
  label: string;
}

export default function SectionsBar({
  sections,
  activeKey,
  onSelect,
  emptyLabel,
}: {
  sections: SectionTab[];
  activeKey: string;
  onSelect: (key: string) => void;
  emptyLabel: string;
}) {
  return (
    <div className="flex border-b border-gray-200 overflow-x-auto shrink-0 bg-white">
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelect(section.key)}
          className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
            activeKey === section.key ? 'text-[#ff4757] border-b-2 border-[#ff4757]' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {section.label}
        </button>
      ))}
      {sections.length === 0 && <p className="px-4 py-3 text-xs text-gray-400">{emptyLabel}</p>}
    </div>
  );
}
