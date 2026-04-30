export function SkeletonBox({ className = "" }) {
  return (
    <div className={`animate-pulse rounded bg-zinc-200 ${className}`} />
  );
}

export function SkeletonText({ className = "", lines = 1, lastLineWidth = "75%" }) {
  if (lines === 1) {
    return <div className={`animate-pulse rounded bg-zinc-200 h-3 ${className}`} />;
  }
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded bg-zinc-200 h-3"
          style={{ width: i === lines - 1 ? lastLineWidth : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonImage({ className = "" }) {
  return (
    <div className={`animate-pulse bg-zinc-200 ${className}`} />
  );
}

export function SkeletonButton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded bg-zinc-200 h-10 w-full ${className}`} />
  );
}
