interface LogoProps {
  name?: string;
  className?: string;
}

// Controller mark + wordmark; the last word of the shop name takes the accent colour.
export function Logo({ name = 'GAMING STATION', className = '' }: LogoProps) {
  const words = name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : '';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 40 40" className="w-9 h-9 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="gs-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8E52FF" />
            <stop offset="1" stopColor="#FF4D9D" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="url(#gs-mark)" />
        <path
          d="M10.5 24.6c0-5 3.6-8.6 8.4-8.6h2.2c4.8 0 8.4 3.6 8.4 8.6 0 2.4-1.5 4.3-3.6 4.3-1.3 0-2.4-.8-3.2-1.8l-.6-.7h-4.2l-.6.7c-.8 1-1.9 1.8-3.2 1.8-2.1 0-3.6-1.9-3.6-4.3Z"
          fill="#fff"
        />
        <path d="M14.8 19.8v3.8m-1.9-1.9h3.8" stroke="#7A35F0" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="24" cy="20.5" r="1.15" fill="#FF4D9D" />
        <circle cx="25.9" cy="22.4" r="1.15" fill="#7A35F0" />
        <circle cx="22.1" cy="22.4" r="1.15" fill="#7A35F0" />
      </svg>
      <span className="font-display font-bold text-[13px] min-[400px]:text-[15px] sm:text-base tracking-[0.04em] leading-none text-white whitespace-nowrap">
        {words.join(' ')}
        {last && <span className="text-brand-accent"> {last}</span>}
      </span>
    </span>
  );
}
