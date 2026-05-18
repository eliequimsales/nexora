import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body do endpoint POST /leads/import.
 *
 * O frontend lê o arquivo CSV no browser (FileReader) e envia o conteúdo
 * como string. Isso evita depender de multer + multipart, deixa o teste
 * trivial e funciona com qualquer tamanho razoável de planilha (até ~5MB).
 *
 * Para arquivos maiores que isso, o caminho seria upload direto pra S3 +
 * processamento async — não é necessário pra MVP de barbearia.
 */
export class ImportLeadsDto {
  // ~5MB de CSV cobre uma base de 50k clientes — mais que suficiente.
  @IsString()
  @MaxLength(5_000_000, { message: 'Arquivo muito grande (limite 5MB)' })
  csvContent!: string;

  /**
   * Se true, o backend retorna o preview do que seria criado SEM persistir.
   * Usado pra confirmar com o usuário antes de gravar.
   */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
