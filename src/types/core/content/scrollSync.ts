import type { GetNextNode, GetPrevNode } from '../../public';

export interface NodeSpan {
  id: string;
  start: number;
  height: number;
}

export interface ReadingOverrides<Meta = unknown> {
  getNextNode?: GetNextNode<Meta> | undefined;
  getPrevNode?: GetPrevNode<Meta> | undefined;
}
