export interface VirtualizerConfig {
  estimateHeight?: number | undefined;
}

export interface VirtualItem {
  id: string;
  index: number;
  start: number;
  height: number;
}

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  items: VirtualItem[];
  paddingTop: number;
  paddingBottom: number;
  totalHeight: number;
}

export interface WindowInput {
  ids: string[];
  scrollTop: number;
  viewportHeight: number;
  overscan?: number | undefined;
}

export interface Virtualizer {
  setHeight(id: string, height: number): number;
  getHeight(id: string): number;
  isMeasured(id: string): boolean;
  offsetAt(ids: string[], index: number): number;
  delete(id: string): boolean;
  getWindow(input: WindowInput): VirtualWindow;
  readonly estimateHeight: number;
}
