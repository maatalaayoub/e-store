"use client";

export default function FormInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  rightSlot,
  inputProps,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-900">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm placeholder-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          {...inputProps}
        />
        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
}
