import { DART_GUIDES } from './darts';
import { LOCKED_DELTA_GUIDES } from './locked-delta';
import { BROAD_GLIDER_GUIDES } from './broad-gliders';
import { CANARD_SWALLOW_GUIDES } from './canard-swallow';
import { SUZANNE_GUIDE } from './suzanne';
import { SKY_KING_GUIDE } from './sky-king';
import { KRSTIC_DART_GUIDE } from './krstic-dart';
import type { FoldGuide } from './schema';

export const FOLD_GUIDES: readonly FoldGuide[] = [
  ...DART_GUIDES, ...LOCKED_DELTA_GUIDES, ...BROAD_GLIDER_GUIDES, ...CANARD_SWALLOW_GUIDES,
  SUZANNE_GUIDE, SKY_KING_GUIDE, KRSTIC_DART_GUIDE,
];

export function getFoldGuide(designId: string): FoldGuide {
  const guide = FOLD_GUIDES.find(item => item.id === designId);
  if (!guide) throw new Error(`Missing illustrated fold guide for ${designId}`);
  return guide;
}
