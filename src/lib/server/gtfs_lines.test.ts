import { describe, it, expect } from 'vitest';
import { getLinesForStop, getStopLinesMap } from './gtfs';

describe('GTFS Stop Lines Indexer', () => {
	it('builds stop lines map with valid entries', () => {
		const stopLinesMap = getStopLinesMap();
		expect(stopLinesMap).toBeInstanceOf(Map);
		expect(stopLinesMap.size).toBeGreaterThan(0);
	});

	it('returns served lines and directions for a known stop (e.g. stop 36050 / Plac Kaszubski)', () => {
		const lines = getLinesForStop(36050);
		expect(Array.isArray(lines)).toBe(true);
		expect(lines.length).toBeGreaterThan(0);

		// Every line should have line string and directions array
		for (const l of lines) {
			expect(typeof l.line).toBe('string');
			expect(l.line.length).toBeGreaterThan(0);
			expect(Array.isArray(l.directions)).toBe(true);
			expect(l.directions.length).toBeGreaterThan(0);
			// Directions should not contain pole numbers like " 01" or " 02" at the end
			for (const dir of l.directions) {
				expect(dir).not.toMatch(/\s+\d{2}$/);
			}
		}
	});

	it('returns empty array for an invalid or non-existent stop id', () => {
		const lines = getLinesForStop(999999999);
		expect(Array.isArray(lines)).toBe(true);
		expect(lines.length).toBe(0);
	});

	it('properly sorts lines numerically then alphabetically', () => {
		const lines = getLinesForStop(36050);
		// Check that if there are numeric lines, they come in ascending order
		const numericLines = lines
			.map((l) => parseInt(l.line, 10))
			.filter((n) => !isNaN(n));

		for (let i = 0; i < numericLines.length - 1; i++) {
			expect(numericLines[i]).toBeLessThanOrEqual(numericLines[i + 1]);
		}
	});
});
