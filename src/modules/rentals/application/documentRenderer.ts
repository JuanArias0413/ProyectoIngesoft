export interface IDocumentRenderer {
  generateResponseLetter(rentalId: string, actorId?: string): Promise<void>;
  generatePriorStudyAndContract(
    rentalId: string,
    version?: number,
    actorId?: string,
  ): Promise<void>;
  generateFinalContract(rentalId: string, actorId?: string): Promise<void>;
}

export class NoopDocumentRenderer implements IDocumentRenderer {
  public async generateResponseLetter(
    _rentalId: string,
    _actorId?: string,
  ): Promise<void> {}
  public async generatePriorStudyAndContract(
    _rentalId: string,
    _version?: number,
    _actorId?: string,
  ): Promise<void> {}
  public async generateFinalContract(
    _rentalId: string,
    _actorId?: string,
  ): Promise<void> {}
}
