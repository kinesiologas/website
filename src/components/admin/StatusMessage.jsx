export function StatusMessage({ message, type = 'info' }) {
  if (!message) {
    return null;
  }

  const styles = {
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
    info: 'border-slate-700 bg-slate-900 text-slate-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  };

  return <p className={`rounded-md border p-3 text-sm leading-6 ${styles[type] ?? styles.info}`}>{message}</p>;
}
