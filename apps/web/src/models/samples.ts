import type { AssetCategoryId } from './pixel';
import knightUrl from '../assets/samples/knight.svg';
import slimeUrl from '../assets/samples/slime.svg';
import swordUrl from '../assets/samples/sword.svg';
import treeUrl from '../assets/samples/tree.svg';

export interface SampleAsset {
  id: string;
  name: string;
  label: string;
  category: AssetCategoryId;
  src: string;
  width: number;
  height: number;
}

/** 内置素材，只用于空状态展示；全部是纯色背景，适合演示白底流程 */
export const SAMPLE_ASSETS: readonly SampleAsset[] = [
  {
    id: 'tree',
    name: 'sample-tree.svg',
    label: '树木',
    category: 'tree',
    src: treeUrl,
    width: 512,
    height: 512,
  },
  {
    id: 'knight',
    name: 'sample-knight.svg',
    label: '角色',
    category: 'character',
    src: knightUrl,
    width: 512,
    height: 512,
  },
  {
    id: 'sword',
    name: 'sample-sword.svg',
    label: '武器',
    category: 'weapon',
    src: swordUrl,
    width: 512,
    height: 512,
  },
  {
    id: 'slime',
    name: 'sample-slime.svg',
    label: '怪物',
    category: 'monster',
    src: slimeUrl,
    width: 512,
    height: 512,
  },
];
