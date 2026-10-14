export interface IDocumentRenderer {
  generateResponseLetter(rentalId: string): Promise<void>;
  generatePriorStudyAndContract(rentalId: string, version: number): Promise<void>;
  generateFinalContract(rentalId: string): Promise<void>;
}

export class NoopDocumentRenderer implements IDocumentRenderer {
  public async generateResponseLetter(_rentalId: string): Promise<void> {}
  public async generatePriorStudyAndContract(_rentalId: string, _version: number): Promise<void> {}
  public async generateFinalContract(_rentalId: string): Promise<void> {}
}
