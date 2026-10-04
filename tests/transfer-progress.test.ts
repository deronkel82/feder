import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTransferProgress,
  durationLabel,
  remainingTime,
  type TransferProgress,
} from '../src/sync/transfer-progress.ts';
void test('ETA waits for measured throughput, adapts to stalled transfers and resets between upload and verification', () => {
  let clock = 1000;
  const events: TransferProgress[] = [];
  const transfer = createTransferProgress(
    (value) => events.push(value),
    () => clock,
  );
  transfer.begin('Upload', 1000, 'bytes');
  assert.equal(events.at(-1)!.remainingSeconds, null);
  clock += 2000;
  transfer.update(250);
  assert.equal(events.at(-1)!.remainingSeconds, 6);
  assert.equal(remainingTime(events.at(-1)!, clock + 2000), 12);
  transfer.update(100); // Retrying must not count bytes twice or go backwards.
  assert.equal(events.at(-1)!.completed, 250);
  transfer.update(2000);
  assert.equal(events.at(-1)!.completed, 1000);
  assert.equal(events.at(-1)!.remainingSeconds, 0);
  transfer.begin('Prüfung', 10, 'blocks');
  assert.equal(events.at(-1)!.completed, 0);
  assert.equal(events.at(-1)!.remainingSeconds, null);
  clock += 3000;
  transfer.update(2);
  assert.equal(events.at(-1)!.remainingSeconds, 12);
});
void test('unknown transfer size remains indeterminate and duration labels make uncertainty visible', () => {
  let latest: TransferProgress | undefined;
  const transfer = createTransferProgress(
    (value) => {
      latest = value;
    },
    () => 5000,
  );
  transfer.begin('Vorbereitung', null, 'bytes');
  transfer.update(100);
  assert.equal(remainingTime(latest!, 10000), null);
  assert.equal(durationLabel(null), 'wird ermittelt …');
  assert.equal(durationLabel(8), 'ca. 10 Sekunden');
  assert.equal(durationLabel(75), 'ca. 2 Minuten');
});
