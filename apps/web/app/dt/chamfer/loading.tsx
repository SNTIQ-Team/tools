export default function ChamferLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center relative z-10">
      <div className="w-8 h-8 border-2 border-[var(--c-text-muted)] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
