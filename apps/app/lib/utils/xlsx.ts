/**
 * XLSX helpers — carregados dinamicamente para não inflar o bundle inicial.
 *
 * O backend só aceita CSV em texto puro. Para suportar XLSX no frontend, lemos
 * o arquivo binário, convertemos para CSV no browser, e mandamos como string.
 * Isso evita multer + multipart na API e mantém o caminho de parse unificado.
 */

const SAMPLE_HEADERS = ['nome', 'telefone', 'email', 'ultima_visita'];
const SAMPLE_ROWS = [
  ['João Silva', '21999998888', 'joao@email.com', '01/12/2024'],
  ['Maria Santos', '21988887777', 'maria@email.com', '15/11/2024'],
];

/**
 * Lê um arquivo XLSX (selecionado pelo usuário) e devolve o conteúdo como CSV.
 * Usa a primeira planilha do arquivo.
 */
export async function xlsxFileToCsv(file: File): Promise<string> {
  // Dynamic import — `xlsx` pesa ~600KB e só é necessário nessa página.
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Planilha vazia ou sem abas.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  // FS=',' força vírgula como separador, blankrows:false remove linhas vazias.
  return XLSX.utils.sheet_to_csv(sheet, { FS: ',', blankrows: false });
}

/**
 * Gera a planilha modelo Nexora (XLSX) e dispara o download no browser.
 */
export async function downloadSampleXlsx(): Promise<void> {
  const XLSX = await import('xlsx');
  const data = [SAMPLE_HEADERS, ...SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Larguras de coluna pra ficar legível ao abrir no Excel
  ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'modelo-clientes-nexora.xlsx');
}
