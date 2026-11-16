/** Text input that formats digits as MM-DD-YYYY while typing. */
export function BirthdayInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <input
      id={id}
      className="input"
      inputMode="numeric"
      autoComplete="off"
      placeholder="MM-DD-YYYY"
      value={value}
      maxLength={10}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
        const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
        onChange(parts.join('-'));
      }}
    />
  );
}

/** True if the string is a real past date in MM-DD-YYYY. */
export function isValidBirthday(v: string): boolean {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v);
  if (!m) return false;
  const [, mm, dd, yyyy] = m.map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd && yyyy >= 1900 && d <= new Date();
}

/** Age in whole years for an MM-DD-YYYY birthday, or null if invalid. */
export function ageOf(v: string): number | null {
  if (!isValidBirthday(v)) return null;
  const [mm, dd, yyyy] = v.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - yyyy;
  if (now.getMonth() + 1 < mm || (now.getMonth() + 1 === mm && now.getDate() < dd)) age--;
  return age;
}
