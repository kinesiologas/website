export function TextInput({ label, textarea = false, ...props }) {
  const Input = textarea ? 'textarea' : 'input';

  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <Input
        className={`mt-2 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-rose-500 ${
          textarea ? 'min-h-28 py-3 leading-6' : 'h-11'
        }`}
        {...props}
      />
    </label>
  );
}

export function SelectInput({ children, label, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <select
        className="mt-2 h-11 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-rose-500"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function CheckboxInput({ checked, label, onChange }) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-slate-300">
      <input
        className="h-4 w-4 accent-rose-600"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
