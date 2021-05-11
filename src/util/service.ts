import { SERVER } from '../config';
import { IS_DEBUG } from './debug';
import { framesToShapeTrack } from './frame';

export interface TestItem {
  shape: number[][];
  track: number[][];
  label: string;
}

export async function fetchTestCases(): Promise<TestItem[]> {
  return (await fetch('/test-cases.json')).json();
}

export async function reco(
  param: ReturnType<typeof framesToShapeTrack>
): Promise<{
  code: number;
  data: string;
}> {
  const addr = `${SERVER}/reco`;
  const prxoy = addr.startsWith('http:') && !IS_DEBUG;

  return (
    await fetch(prxoy ? '/api/proxy' : addr, {
      method: 'post',
      body: JSON.stringify(Object.assign({}, param, prxoy ? { addr } : {})),
      mode: 'cors',
    })
  ).json();
}
