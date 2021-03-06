import { fill, flatten, pick } from 'lodash-es';

import { useFrameMod } from '../hooks/use-frame-mod';

type Point = [number, number, number];

interface Bone {
  prevJoint: Point;
  nextJoint: Point;
}
interface Finger {
  dipPosition: Point;
  pipPosition: Point;
  mcpPosition: Point;
  carpPosition: Point;
  distal: Bone;
  /**
    0 -- thumb
    1 -- index finger
    2 -- middle finger
    3 -- ring finger
    4 -- pinky
  */
  type: number;
  valid: boolean;
}

interface Hand {
  fingers: Finger[];
  // prevJoint: elbow, nextJoint: wrist; https://github.com/leapmotion/leapjs/blob/d916eb491dbaf5d43dd730685b79f6483ae9005d/lib/hand.js#L140
  arm: Bone;
  type: 'left' | 'right';
  valid: boolean;
}

export interface Frame {
  currentFrameRate: number;
  timestamp: number;
  hands: Hand[];
  valid: boolean;
  type: 'frame';
}

export function convertFrame(frame: any): Frame {
  const result: Frame = {
    currentFrameRate: frame?.currentFrameRate ?? 0,
    hands: [],
    valid: !!frame?.valid,
    type: 'frame',
    timestamp: frame?.timestamp ?? 0,
  };
  if (Array.isArray(frame.hands)) {
    for (let index = 0; index < frame.hands.length; index++) {
      const oHand = frame.hands[index];
      result.hands.push({
        type: oHand.type,
        valid: oHand.valid,
        arm: {
          prevJoint: oHand.arm.prevJoint,
          nextJoint: oHand.arm.nextJoint,
        },
        fingers: oHand.fingers.map((finger: any) =>
          pick(finger, [
            'dipPosition',
            'pipPosition',
            'mcpPosition',
            'carpPosition',
            'btipPosition', // FIXME: distal.nextJoint https://github.com/leapmotion/leapjs/blob/d916eb491dbaf5d43dd730685b79f6483ae9005d/lib/finger.js#L177
            'type',
            'valid',
          ])
        ),
      });
    }
  }
  return result;
}

const localConfig = {
  includeElbow: false,
};

const handToPoints = (hand: Hand): Point[] => [
  ...(localConfig.includeElbow
    ? [hand.arm.nextJoint, hand.arm.prevJoint]
    : [hand.arm.nextJoint]),
  ...flatten(
    hand.fingers
      .sort((a, b) => a.type - b.type)
      .map((finger) => [
        finger.mcpPosition,
        finger.pipPosition,
        finger.dipPosition,
        finger.distal.nextJoint,
      ])
  ),
];

const handToArray = (hand: Hand): number[] => flatten(handToPoints(hand));

function handToShapeArray(hand: Hand): number[] {
  const points = handToPoints(hand);
  const [x, y, z] = points[0];
  return flatten(points.map(([px, py, pz]) => [px - x, py - y, pz - z]));
}

function frameToArray(frame: Frame, shape?: boolean): number[] {
  const leftHand = frame.hands.find(({ type }) => type === 'left');
  const rightHand = frame.hands.find(({ type }) => type === 'right');

  const leftHandArray = leftHand
    ? (shape ? handToShapeArray : handToArray)(leftHand)
    : fill(Array(localConfig.includeElbow ? 66 : 63), 0);

  const rightHandArray = rightHand
    ? (shape ? handToShapeArray : handToArray)(rightHand)
    : fill(Array(localConfig.includeElbow ? 66 : 63), 0);

  return flatten([leftHandArray, rightHandArray]);
}

export function framesToShapeTrack(frames: Frame[]) {
  localConfig.includeElbow = true;
  const frameMod = useFrameMod.data?.[0] ?? 5;
  frames = frames.filter((_, index) => index % frameMod === 0);
  const shape = frames.map((f) => frameToArray(f, true));
  const track: number[][] = [];

  frames
    .map((f) => frameToArray(f))
    .reduce((prev, cur) => {
      track.push(
        cur.map((curValue, curIndex) => {
          return curValue && prev[curIndex] ? curValue - prev[curIndex] : 0;
        })
      );
      return cur;
    }, fill(Array(localConfig.includeElbow ? 66 : 63), 0));

  return { shape, track };
}

export function framesToList(frames: Frame[]) {
  localConfig.includeElbow = false;
  return {
    data: frames.map((f) => frameToArray(f, true)),
  };
}
