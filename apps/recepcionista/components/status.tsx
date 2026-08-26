export const STATUS_LABEL: Record<string, string> = {
  AI: "Atendente respondendo",
  WAITING_HUMAN: "Aguardando sua equipe",
  HUMAN: "Equipe atendendo",
  FINISHED: "Finalizada",
};

const STATUS_STYLE: Record<string, string> = {
  AI: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WAITING_HUMAN: "bg-amber-50 text-amber-700 border-amber-300",
  HUMAN: "bg-sky-50 text-sky-700 border-sky-200",
  FINISHED: "bg-gray-100 text-gray-500 border-gray-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLE[status] ?? STATUS_STYLE.FINISHED
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
