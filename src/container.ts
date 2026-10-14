import { prisma } from './infra/prisma.js';
import { DocumentRenderer } from './modules/documents/documentRenderer.js';
import type { IDocumentRenderer } from './modules/rentals/application/IDocumentRenderer.js';

export interface AppContainer {
  documentRenderer: IDocumentRenderer;
}

export function createContainer(): AppContainer {
  return {
    documentRenderer: new DocumentRenderer(prisma),
  };
}

export const container = createContainer();
