export default function DatePicker({ label, value, onChange, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      )}
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );
}
