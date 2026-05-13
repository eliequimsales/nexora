export class PlanLimitException extends Error {
  constructor(
    public readonly resource: 'leads' | 'aiExecutions',
    message = 'Limite do plano atingido',
  ) {
    super(message);
    this.name = 'PlanLimitException';
  }
}
