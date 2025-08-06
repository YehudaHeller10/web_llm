function formatBytes(size) {
  const i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return (
    +(size / Math.pow(1024, i)).toFixed(2) * 1 +
    ["B", "kB", "MB", "GB", "TB"][i]
  );
}

export default function Progress({ text, percentage, total }) {
  percentage ??= 0;
  return (
    <div className="w-full glass rounded-xl overflow-hidden mb-3">
      <div className="flex justify-between items-center p-3 pb-2">
        <span className="text-sm font-medium text-white truncate">{text}</span>
        <span className="text-xs text-blue-300 ml-2">
          {percentage.toFixed(1)}%
          {!isNaN(total) && ` of ${formatBytes(total)}`}
        </span>
      </div>
      <div className="px-3 pb-3">
        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300 ease-out glow-blue"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
