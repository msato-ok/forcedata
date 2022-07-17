import { Segment } from '../parser/segmenter';

export interface Printer {
  print(segments: Segment[], outputPath: string): void;
}
