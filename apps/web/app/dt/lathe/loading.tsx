export default function LatheLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center relative z-10">
      <div
        aria-hidden="true"
        className="w-6 h-6 rounded-full border-2 border-[color-mix(in_srgb,var(--c-text-main)_18%,transparent)] border-t-[var(--c-text-main)] animate-spin"
      ></div>
    </div>
  );
}
